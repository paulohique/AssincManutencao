<?php

include('../../../inc/includes.php');

// Ensure cron class is loaded for manual actions.
$cronClass = dirname(__DIR__) . '/inc/cron.class.php';
if (!class_exists('PluginAssincsyncCron') && file_exists($cronClass)) {
   include_once($cronClass);
}

Session::checkRight('config', UPDATE);

if (isset($_POST['run_full'])) {
   // Manual full sync
   $ok = 0;
   try {
      if (class_exists('PluginAssincsyncCron')) {
         $ok = PluginAssincsyncCron::cronFull(null);
      }
   } catch (Exception $e) {
      $ok = 0;
   }

   if ($ok) {
      Session::addMessageAfterRedirect('Full sync disparado com sucesso.');
   } else {
      Session::addMessageAfterRedirect('Falha ao disparar full sync. Verifique URL/token e logs.', false, ERROR);
   }
   Html::redirect($_SERVER['PHP_SELF']);
   exit;
}

if (isset($_POST['run_incremental'])) {
   // Manual incremental run
   $ok = 0;
   try {
      if (class_exists('PluginAssincsyncCron')) {
         $ok = PluginAssincsyncCron::cronTrigger(null);
      }
   } catch (Exception $e) {
      $ok = 0;
   }

   if ($ok) {
      Session::addMessageAfterRedirect('Incremental executado/disparado com sucesso.');
   } else {
      Session::addMessageAfterRedirect('Falha ao executar incremental. Verifique URL/token e logs.', false, ERROR);
   }
   Html::redirect($_SERVER['PHP_SELF']);
   exit;
}

if (isset($_POST['update'])) {
   $py_api_url = isset($_POST['py_api_url']) ? trim($_POST['py_api_url']) : '';
   $webhook_token = isset($_POST['webhook_token']) ? trim($_POST['webhook_token']) : '';
   $timeout_seconds = isset($_POST['timeout_seconds']) ? trim($_POST['timeout_seconds']) : '15';
   $initial_lookback_minutes = isset($_POST['initial_lookback_minutes']) ? trim($_POST['initial_lookback_minutes']) : '1440';
   $batch_size = isset($_POST['batch_size']) ? trim($_POST['batch_size']) : '200';

   Config::setConfigurationValues('plugin:assincsync', [
      'py_api_url' => $py_api_url,
      'webhook_token' => $webhook_token,
      'timeout_seconds' => $timeout_seconds,
      'initial_lookback_minutes' => $initial_lookback_minutes,
      'batch_size' => $batch_size,
   ]);

   Session::addMessageAfterRedirect('Configurações salvas.');
   Html::redirect($_SERVER['PHP_SELF']);
   exit;
}

Html::header('Assinc Sync', $_SERVER['PHP_SELF'], 'config', 'plugins');

$cfg = Config::getConfigurationValues('plugin:assincsync');
$py_api_url = isset($cfg['py_api_url']) ? $cfg['py_api_url'] : '';
$webhook_token = isset($cfg['webhook_token']) ? $cfg['webhook_token'] : '';
$timeout_seconds = isset($cfg['timeout_seconds']) ? $cfg['timeout_seconds'] : '15';
$last_success_at = isset($cfg['last_success_at']) ? $cfg['last_success_at'] : '';
$full_sync_done = isset($cfg['full_sync_done']) ? $cfg['full_sync_done'] : '0';
$full_sync_last_at = isset($cfg['full_sync_last_at']) ? $cfg['full_sync_last_at'] : '';
$cursor_at = isset($cfg['cursor_at']) ? $cfg['cursor_at'] : '';
$cursor_id = isset($cfg['cursor_id']) ? $cfg['cursor_id'] : '0';
$initial_lookback_minutes = isset($cfg['initial_lookback_minutes']) ? $cfg['initial_lookback_minutes'] : '1440';
$batch_size = isset($cfg['batch_size']) ? $cfg['batch_size'] : '200';

echo "<div class='center'>";
echo "<form method='post' action='' style='max-width: 900px; text-align:left;'>";

// GLPI 10+ exige CSRF token em POST (plugins marcados como csrf_compliant).
echo Html::hidden('_glpi_csrf_token', ['value' => Session::getNewCSRFToken()]);
echo "<h2>Assinc Sync</h2>";
echo "<p>Este plugin registra uma ação automática (cron) que chama sua Python API para disparar a sincronização do inventário do GLPI.</p>";

echo "<table class='tab_cadre_fixe'>";

echo "<tr class='tab_bg_1'><td>URL base da Python API</td><td>";
echo "<input type='text' name='py_api_url' value='" . Html::cleanInputText($py_api_url) . "' style='width: 100%;' placeholder='http://seu-servidor:8000' />";
echo "<div class='small'>Endpoints: <code>/api/webhook/glpi/trigger</code> (full) e <code>/api/webhook/glpi/push</code> (incremental)</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Webhook token</td><td>";
echo "<input type='password' name='webhook_token' value='" . Html::cleanInputText($webhook_token) . "' style='width: 100%;' />";
echo "<div class='small'>Enviado em <code>X-Glpi-Webhook-Token</code>. Deve bater com <code>GLPI_WEBHOOK_TOKEN</code> na Python API.</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Timeout (segundos)</td><td>";
echo "<input type='number' min='5' max='120' name='timeout_seconds' value='" . Html::cleanInputText($timeout_seconds) . "' />";
echo "<div class='small'>Para full sync, use um timeout maior (pode levar minutos dependendo do inventário).</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Full sync</td><td>";
echo "<input type='text' disabled value='" . Html::cleanInputText($full_sync_done === '1' ? 'OK' : 'PENDENTE') . "' style='width: 120px;' />";
echo "<input type='text' disabled value='" . Html::cleanInputText($full_sync_last_at) . "' style='width: 260px; margin-left:8px;' placeholder='(nunca)' />";
echo "<div class='small'>O incremental só roda após o full sync ter sido executado pelo menos uma vez.</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Último sucesso (cursor)</td><td>";
echo "<input type='text' disabled value='" . Html::cleanInputText($last_success_at) . "' style='width: 260px;' placeholder='(ainda não executou)' />";
echo "<div class='small'>O cron envia IDs de computadores criados/alterados desde esse horário.</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Cursor detalhado</td><td>";
echo "<input type='text' disabled value='" . Html::cleanInputText($cursor_at) . "' style='width: 260px;' placeholder='(vazio)' />";
echo "<input type='text' disabled value='" . Html::cleanInputText($cursor_id) . "' style='width: 120px; margin-left:8px;' placeholder='0' />";
echo "<div class='small'>Cursor robusto por <code>date_mod</code> + <code>id</code> para não repetir lotes.</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Lookback inicial (minutos)</td><td>";
echo "<input type='number' min='10' max='10080' name='initial_lookback_minutes' value='" . Html::cleanInputText($initial_lookback_minutes) . "' />";
echo "<div class='small'>Usado somente se o cursor estiver vazio (primeira execução).</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td>Tamanho do lote (batch)</td><td>";
echo "<input type='number' min='10' max='1000' name='batch_size' value='" . Html::cleanInputText($batch_size) . "' />";
echo "<div class='small'>Se retornar exatamente o limite, o cursor não avança (evita perder itens).</div>";
echo "</td></tr>";

echo "<tr class='tab_bg_1'><td colspan='2' class='center'>";
echo "<input type='submit' class='submit' name='update' value='Salvar' />";
echo "&nbsp;&nbsp;";
echo "<input type='submit' class='submit' name='run_full' value='Sincronizar TODOS agora' />";
echo "&nbsp;&nbsp;";
echo "<input type='submit' class='submit' name='run_incremental' value='Rodar incremental agora' />";
echo "</td></tr>";

echo "</table>";

echo "</form>";

echo "<h3>Ações automáticas</h3>";
echo "<p>Após salvar, vá em <b>Setup &gt; Automatic actions</b> e procure por <code>assincsync</code> / <code>trigger</code> para ajustar frequência.</p>";

echo "</div>";

Html::footer();
