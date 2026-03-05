<?php

class PluginAssincsyncCron {
   private static function _log($task, $message) {
      if (is_object($task)) {
         $task->log($message);
      }
   }

   private static function _extractJsonStatus($body) {
      if (!is_string($body) || trim($body) === '') {
         return [null, null];
      }
      $parsed = json_decode($body, true);
      if (!is_array($parsed)) {
         return [null, null];
      }
      $status = isset($parsed['status']) ? strval($parsed['status']) : null;
      $msg = isset($parsed['message']) ? strval($parsed['message']) : null;
      return [$status, $msg];
   }

   private static function _curlPostJson($url, $token, $payload, $timeout) {
      $ch = curl_init($url);
      if ($ch === false) {
         return [false, 0, '', 'curl_init failed'];
      }

      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_HTTPHEADER, [
         'Content-Type: application/json',
         'X-Glpi-Webhook-Token: ' . $token,
      ]);
      if (!is_null($payload)) {
         curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
      }

      $timeout = intval($timeout);
      if ($timeout <= 0) {
         $timeout = 15;
      }
      curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
      curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(10, $timeout));

      $body = curl_exec($ch);
      $err = curl_error($ch);
      $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);

      if ($err) {
         return [false, $code, is_string($body) ? $body : '', $err];
      }

      if ($code >= 200 && $code < 300) {
         return [true, $code, is_string($body) ? $body : '', ''];
      }

      return [false, $code, is_string($body) ? $body : '', 'HTTP ' . $code];
   }

   static function cronInfo($name) {
      switch ($name) {
         case 'full':
            return [
               'description' => 'Sincroniza TODOS os computadores (full sync).'
            ];
         case 'trigger':
            return [
               'description' => 'Dispara o sync do Assinc Manutenções (chama a Python API).'
            ];
      }
      return [];
   }

   static function cronFull($task) {
      $cfg = Config::getConfigurationValues('plugin:assincsync');
      $baseUrl = isset($cfg['py_api_url']) ? trim($cfg['py_api_url']) : '';
      $token = isset($cfg['webhook_token']) ? trim($cfg['webhook_token']) : '';
      $timeout = isset($cfg['timeout_seconds']) ? intval($cfg['timeout_seconds']) : 60;
      if ($timeout <= 0) {
         $timeout = 60;
      }

      if ($baseUrl === '' || $token === '') {
         self::_log($task, 'AssincSync: configure py_api_url e webhook_token em Setup > Plugins > Assinc Sync');
         return 0;
      }

      // Full sync: roda de forma síncrona para garantir que completou.
      $url = rtrim($baseUrl, '/') . '/api/webhook/glpi/trigger?async=false';
      list($ok, $code, $body, $err) = self::_curlPostJson($url, $token, new stdClass(), $timeout);

      if (!$ok) {
         $snippet = is_string($body) ? substr($body, 0, 800) : '';
         self::_log($task, 'AssincSync: full sync falhou (' . $code . ') err=' . $err . ' body=' . $snippet);
         return 0;
      }

      // A API pode responder 200 com status=running; isso não deve marcar full como concluído.
      list($status, $msg) = self::_extractJsonStatus($body);
      if ($status !== null && $status !== 'success') {
         // Se já existe sync em andamento, não é erro: apenas não marca como done.
         if ($status === 'running') {
            self::_log($task, 'AssincSync: full sync já em andamento (status=running)' . ($msg ? ' msg=' . $msg : ''));
            return 1;
         }
         self::_log($task, 'AssincSync: full sync não executado (status=' . $status . ')' . ($msg ? ' msg=' . $msg : ''));
         return 0;
      }

      Config::setConfigurationValues('plugin:assincsync', [
         'full_sync_done' => '1',
         'full_sync_last_at' => date('Y-m-d H:i:s'),
      ]);
      self::_log($task, 'AssincSync: full sync OK (' . $code . ')');
      return 1;
   }

   static function cronTrigger($task) {
      if (!class_exists('Config')) {
         return 0;
      }

      global $DB;
      if (!isset($DB)) {
         if (is_object($task)) {
            $task->log('AssincSync: DB não disponível');
         }
         return 0;
      }

      $cfg = Config::getConfigurationValues('plugin:assincsync');
      $baseUrl = isset($cfg['py_api_url']) ? trim($cfg['py_api_url']) : '';
      $token = isset($cfg['webhook_token']) ? trim($cfg['webhook_token']) : '';
      $timeout = isset($cfg['timeout_seconds']) ? intval($cfg['timeout_seconds']) : 15;
      $fullDone = isset($cfg['full_sync_done']) ? trim($cfg['full_sync_done']) : '0';
      $cursorAt = isset($cfg['cursor_at']) ? trim($cfg['cursor_at']) : '';
      $cursorId = isset($cfg['cursor_id']) ? intval($cfg['cursor_id']) : 0;
      // compat legado
      $lastSuccessAt = isset($cfg['last_success_at']) ? trim($cfg['last_success_at']) : '';
      $initialLookbackMinutes = isset($cfg['initial_lookback_minutes']) ? intval($cfg['initial_lookback_minutes']) : 1440;
      $batchSize = isset($cfg['batch_size']) ? intval($cfg['batch_size']) : 200;
      if ($timeout <= 0) {
         $timeout = 15;
      }
      if ($initialLookbackMinutes <= 0) {
         $initialLookbackMinutes = 1440;
      }
      if ($batchSize <= 0) {
         $batchSize = 200;
      }

      if ($baseUrl === '' || $token === '') {
         if (is_object($task)) {
            $task->log('AssincSync: configure py_api_url e webhook_token em Setup > Plugins > Assinc Sync');
         }
         return 0;
      }

      // GARANTE o fluxo: primeiro sync completo (uma vez), depois incremental.
      if ($fullDone !== '1') {
         self::_log($task, 'AssincSync: full sync ainda não foi executado; rodando agora antes do incremental...');
         $okFull = self::cronFull($task);
         if (!$okFull) {
            return 0;
         }
      }

      // Cursor: usa cursor_at/cursor_id; se vazio, faz lookback inicial.
      $since = $cursorAt;
      if ($since === '') {
         // compat: se existia last_success_at (legado), migra para cursor_at.
         if ($lastSuccessAt !== '') {
            $since = $lastSuccessAt;
         }
      }

      if ($since === '') {
         $sinceTs = time() - ($initialLookbackMinutes * 60);
         $since = date('Y-m-d H:i:s', $sinceTs);
      }

      // Pega computadores criados/alterados desde $since.
      // Cursor robusto: (COALESCE(date_mod,date_creation), id)
      $esc = $since;
      if (method_exists($DB, 'escape')) {
         $esc = $DB->escape($since);
      } else {
         $esc = addslashes($since);
      }

      $sql = "SELECT id, COALESCE(date_mod, date_creation) AS cursor_ts "
         . "FROM glpi_computers "
         . "WHERE (COALESCE(date_mod, date_creation) > '" . $esc . "' "
         . "   OR (COALESCE(date_mod, date_creation) = '" . $esc . "' AND id > " . intval($cursorId) . ")) "
         . "ORDER BY cursor_ts ASC, id ASC "
         . "LIMIT " . intval($batchSize);
      $res = $DB->query($sql);
      if (!$res) {
         if (is_object($task)) {
            $task->log('AssincSync: query glpi_computers falhou');
         }
         return 0;
      }

      $ids = [];
      $lastRowTs = '';
      $lastRowId = 0;
      while ($row = $DB->fetchAssoc($res)) {
         if (!isset($row['id'])) {
            continue;
         }
         $rid = intval($row['id']);
         if ($rid <= 0) {
            continue;
         }
         $ids[] = $rid;
         if (isset($row['cursor_ts'])) {
            $lastRowTs = $row['cursor_ts'];
         }
         $lastRowId = $rid;
      }

      if (count($ids) === 0) {
         if (is_object($task)) {
            $task->log('AssincSync: nenhum computador novo/alterado desde ' . $since);
         }
         return 1;
      }

      // Envia sincrono para garantir processamento (se quiser async, aumente timeout e use cron mais frequente).
      $url = rtrim($baseUrl, '/') . '/api/webhook/glpi/push?async=false';
      list($ok, $code, $body, $err) = self::_curlPostJson($url, $token, [
         'computer_ids' => $ids,
      ], $timeout);

      if (!$ok) {
         $snippet = is_string($body) ? substr($body, 0, 800) : '';
         self::_log($task, 'AssincSync: push falhou (' . $code . ') err=' . $err . ' body=' . $snippet);
         return 0;
      }

      // Evita avançar cursor se o backend respondeu "running" (já existe sync em andamento)
      // ou qualquer coisa diferente de success.
      list($status, $msg) = self::_extractJsonStatus($body);
      if ($status !== null && $status !== 'success') {
         // "running" não é falha: apenas aguardar próxima execução.
         if ($status === 'running') {
            self::_log($task, 'AssincSync: push ignorado pois sync já está em andamento (status=running)' . ($msg ? ' msg=' . $msg : ''));
            return 1;
         }
         self::_log($task, 'AssincSync: push não executado (status=' . $status . ')' . ($msg ? ' msg=' . $msg : ''));
         return 0;
      }

      // Avança cursor SEMPRE até o último item retornado, mesmo em lote cheio.
      // Isso garante que não repete o mesmo lote para sempre.
      if ($lastRowTs === '') {
         $lastRowTs = date('Y-m-d H:i:s');
      }
      Config::setConfigurationValues('plugin:assincsync', [
         'cursor_at' => $lastRowTs,
         'cursor_id' => strval(intval($lastRowId)),
         'last_success_at' => $lastRowTs,
      ]);

      self::_log($task, 'AssincSync: push OK (' . $code . ') ids=' . count($ids) . ' cursor=' . $lastRowTs . ' #' . intval($lastRowId));
      return 1;
   }
}
