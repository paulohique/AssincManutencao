<?php

define('PLUGIN_ASSINCSYNC_VERSION', '0.1.0');

define('PLUGIN_ASSINCSYNC_MIN_GLPI', '10.0.0');
define('PLUGIN_ASSINCSYNC_MAX_GLPI', '10.99.99');

function plugin_version_assincsync() {
   return [
      'name'           => 'Assinc Sync',
      'version'        => PLUGIN_ASSINCSYNC_VERSION,
      'author'         => 'Assinc Manutenções',
      'license'        => 'GPLv2+',
      'homepage'       => '',
      'minGlpiVersion' => PLUGIN_ASSINCSYNC_MIN_GLPI,
      'maxGlpiVersion' => PLUGIN_ASSINCSYNC_MAX_GLPI,
      'requirements'   => [
         'glpi' => [
            'min' => PLUGIN_ASSINCSYNC_MIN_GLPI,
            'max' => PLUGIN_ASSINCSYNC_MAX_GLPI,
         ]
      ]
   ];
}

function plugin_assincsync_check_prerequisites() {
   return true;
}

function plugin_assincsync_check_config($verbose = false) {
   return true;
}

function plugin_init_assincsync() {
   global $PLUGIN_HOOKS;

   // Make sure plugin classes are available.
   $cronClass = __DIR__ . '/inc/cron.class.php';
   if (file_exists($cronClass)) {
      include_once($cronClass);
   }

   $PLUGIN_HOOKS['csrf_compliant']['assincsync'] = true;
   $PLUGIN_HOOKS['config_page']['assincsync'] = 'front/config.form.php';

   // Register cron tasks that call the external Python API.
   // They will appear in Setup > Automatic actions.
   if (class_exists('CronTask')) {
      CronTask::Register('PluginAssincsyncCron', 'full', 86400, [
         'comment' => 'Sincroniza TODOS os computadores (full sync) via Python API.'
      ]);
      CronTask::Register('PluginAssincsyncCron', 'trigger', 3600, [
         'comment' => 'Sincroniza incrementalmente (IDs alterados desde o cursor) via Python API.'
      ]);
   }
}

function plugin_assincsync_install() {
   // Stores plugin configuration in GLPI config table.
   if (class_exists('Config')) {
      Config::setConfigurationValues('plugin:assincsync', [
         'py_api_url' => '',
         'webhook_token' => '',
         'timeout_seconds' => '15',
         // full sync state
         'full_sync_done' => '0',
         'full_sync_last_at' => '',

         // incremental cursor (robusto: timestamp + id)
         // cursor_at: último date_mod processado com sucesso
         'cursor_at' => '',
         'cursor_id' => '0',
         // compat (legado)
         'last_success_at' => '',
         // se last_success_at estiver vazio, busca mudanças dos últimos N minutos
         'initial_lookback_minutes' => '1440',
         'batch_size' => '200',
      ]);
   }
   return true;
}

function plugin_assincsync_uninstall() {
   if (class_exists('Config')) {
      Config::deleteConfigurationValues('plugin:assincsync', [
         'py_api_url',
         'webhook_token',
         'timeout_seconds',
         'full_sync_done',
         'full_sync_last_at',
         'cursor_at',
         'cursor_id',
         'last_success_at',
         'initial_lookback_minutes',
         'batch_size',
      ]);
   }
   return true;
}
