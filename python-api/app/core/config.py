from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_NAME: str = "glpi_manutencao"

    # GLPI API
    GLPI_BASE_URL: str = "http://suporte.barbacena.mg.gov.br:8585/glpi/apirest.php"
    GLPI_APP_TOKEN: str
    GLPI_USER_TOKEN: str

    # GLPI - Tickets list cache (evita sobrecarregar o GLPI)
    GLPI_TICKETS_CACHE_TTL_SECONDS: int = 30
    # Se o GLPI estiver fora, permite servir último cache por um tempo (evita dropdown vazio)
    GLPI_TICKETS_CACHE_STALE_MAX_SECONDS: int = 10 * 60

    # GLPI - Outbox (evita perder follow-up quando GLPI estiver indisponível)
    GLPI_OUTBOX_WORKER_ENABLED: bool = False
    GLPI_OUTBOX_PROCESS_INTERVAL_SECONDS: int = 60
    GLPI_OUTBOX_PROCESS_BATCH_SIZE: int = 25

    # Webhook (ex.: plugin GLPI chamando esta API para disparar sincronização)
    # Configure um segredo compartilhado e envie em "X-Glpi-Webhook-Token".
    GLPI_WEBHOOK_TOKEN: str = "TESTESS"

    # Opcional: allowlist de IP/CIDR de onde o webhook pode ser chamado.
    # Ex.: "10.0.0.10" ou "10.0.0.0/24" (múltiplos separados por vírgula).
    # Se vazio, permite qualquer IP (segurança fica por conta do token + TLS/firewall).
    GLPI_WEBHOOK_ALLOWED_IPS: str = ""

    # GLPI - Escrita em ticket
    # Por padrão, a aplicação cria um follow-up/comentário (normalmente aparece "cinza" no GLPI).
    # Se habilitado, tenta criar uma SOLUÇÃO (ITILSolution), que aparece como solução (geralmente "azul").
    GLPI_SEND_AS_SOLUTION: bool = True
    # Opcional: id do tipo de solução no GLPI (solutiontypes_id). Se 0, não envia o campo.
    GLPI_SOLUTION_TYPE_ID: int = 0

    # App
    CORS_ORIGINS: str = "http://localhost:3000"
    MAINTENANCE_INTERVAL_DAYS: int = 365

    # Auth (LDAP/AD + JWT)
    AUTH_ENABLED: bool = True
    JWT_SECRET: str = "change-me"  # troque via .env
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 12 * 60

    # Login
    # Mantém login local sempre disponível.
    # Se no futuro quiser permitir login via LDAP/AD, habilite esta flag e configure LDAP_*.
    LOGIN_ALLOW_LDAP: bool = True

    # LDAP (Active Directory)
    LDAP_SERVER: str = ""  # ex: ldap://dc01.seudominio.local ou ldaps://dc01.seudominio.local
    LDAP_BASE_DN: str = ""  # ex: DC=seudominio,DC=local
    LDAP_DOMAIN: str = ""  # ex: seudominio.local (para usar username@domain no bind)
    LDAP_USE_SSL: bool = False
    LDAP_CONNECT_TIMEOUT_SECONDS: int = 10

    class Config:
        # python-api/.env (mantém compatibilidade com configuração atual)
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        case_sensitive = True


settings = Settings()
