"""Entrypoint para o uvicorn.

Mantém compatibilidade com `uvicorn main:app`.
O código da aplicação foi apenas reestruturado em MVC em `app/`.
"""

from app.main import app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
