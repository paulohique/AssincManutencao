from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings


class GlpiClient:
    def __init__(self):
        self.base_url = settings.GLPI_BASE_URL
        self.app_token = settings.GLPI_APP_TOKEN
        self.user_token = settings.GLPI_USER_TOKEN
        self.session_token: Optional[str] = None

        # Evita travar indefinidamente em rede/GLPI.
        self._timeout = httpx.Timeout(30.0, connect=10.0)

    def _build_headers(self, path: str, *, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {"App-Token": self.app_token}
        if path.endswith("/initSession"):
            headers["Authorization"] = f"user_token {self.user_token}"
        else:
            headers["Session-Token"] = str(self.session_token)

        if extra_headers:
            headers.update({k: str(v) for k, v in extra_headers.items() if v is not None})
        return headers

    async def _get_response(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> httpx.Response:
        """Requisição GET ao GLPI, retornando o httpx.Response.

        Alguns endpoints do GLPI respeitam paginação via query `range`, outros via
        header `Range`. Por isso, deixamos o chamador injetar headers extras.
        """
        if not self.session_token and not path.endswith("/initSession"):
            await self.init_session()

        headers = self._build_headers(path, extra_headers=extra_headers)

        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}{path}", headers=headers, params=params)
            response.raise_for_status()
            return response

    @staticmethod
    def _normalize_list_payload(data: Any) -> List[Dict[str, Any]]:
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            for key in ("data", "results", "items"):
                v = data.get(key)
                if isinstance(v, list):
                    return [x for x in v if isinstance(x, dict)]
        return []

    async def _get_list_paged(
        self,
        path: str,
        *,
        chunk_size: int = 100,
        params: Optional[Dict[str, Any]] = None,
        max_pages: int = 200,
    ) -> List[Dict[str, Any]]:
        """Busca uma lista paginada do GLPI, acumulando todas as páginas.

        - Usa `range` tanto em query quanto em header (compatibilidade).
        - Para em 416/400 (range inválido) e em resposta vazia.
        """
        chunk_size = max(1, min(int(chunk_size), 500))
        base_params: Dict[str, Any] = dict(params or {})
        out: List[Dict[str, Any]] = []

        start = 0
        for _ in range(max_pages):
            end = start + chunk_size - 1
            range_str = f"{start}-{end}"

            page_params = dict(base_params)
            # Alguns GLPIs aceitam via query, outros via header; mandamos ambos.
            page_params["range"] = range_str

            try:
                resp = await self._get_response(path, params=page_params, extra_headers={"Range": range_str})
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code if exc.response is not None else None
                if status in (400, 416):
                    break
                if status == 404:
                    return []
                raise

            items = self._normalize_list_payload(data)
            if not items:
                break

            out.extend(items)
            if len(items) < chunk_size:
                break
            start += chunk_size

        return out

    async def _get(self, path: str, *, params: Optional[Dict[str, Any]] = None) -> Any:
        """Requisição GET ao GLPI."""
        response = await self._get_response(path, params=params)
        return response.json()

    async def _post(self, path: str, *, json: Optional[Dict[str, Any]] = None) -> Any:
        """Requisição POST ao GLPI.

        Observação: originalmente a integração era somente-leitura. Este método existe
        para suportar casos de uso explícitos (ex.: adicionar followup em Ticket).
        """
        if not self.session_token:
            await self.init_session()

        headers: Dict[str, str] = self._build_headers(path)
        headers["Content-Type"] = "application/json"

        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            response = await client.post(f"{self.base_url}{path}", headers=headers, json=json)
            response.raise_for_status()
            if not response.content:
                return None
            try:
                return response.json()
            except Exception:
                return response.text

    async def _put(self, path: str, *, json: Optional[Dict[str, Any]] = None) -> Any:
        """Requisição PUT ao GLPI (best-effort)."""
        if not self.session_token:
            await self.init_session()

        headers: Dict[str, str] = self._build_headers(path)
        headers["Content-Type"] = "application/json"

        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            response = await client.put(f"{self.base_url}{path}", headers=headers, json=json)
            response.raise_for_status()
            if not response.content:
                return None
            try:
                return response.json()
            except Exception:
                return response.text

    async def init_session(self) -> str:
        """Inicializa sessão com GLPI API"""
        data = await self._get("/initSession")
        self.session_token = data.get("session_token")
        return self.session_token

    async def kill_session(self):
        """Encerra sessão com GLPI API"""
        if not self.session_token:
            return

        try:
            await self._get("/killSession")
        finally:
            self.session_token = None

    async def get_computers(self, start: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        """Busca lista de computadores"""
        limit = max(1, min(int(limit), 500))
        start = max(0, int(start))
        end = start + limit - 1

        # Compatibilidade: tenta via query + header Range.
        resp = await self._get_response(
            "/Computer",
            params={
                "range": f"{start}-{end}",
                "expand_dropdowns": "true",
            },
            extra_headers={"Range": f"{start}-{end}"},
        )
        data = resp.json()
        return self._normalize_list_payload(data)

    async def get_open_tickets(self, *, limit: int = 200) -> List[Dict[str, Any]]:
        """Busca tickets abertos (best-effort).

        A API do GLPI não tem um filtro universal simples via /Ticket; por isso buscamos
        um range inicial e filtramos em memória.
        """
        limit = max(1, min(int(limit), 500))

        base_params: Dict[str, Any] = {
            "range": f"0-{limit - 1}",
            "expand_dropdowns": "true",
        }

        # GLPI normalmente suporta sort/order; isso permite pegar os tickets mais recentes.
        # Se a instalação não suportar, faz fallback para o comportamento anterior.
        try:
            data = await self._get(
                "/Ticket",
                params={
                    **base_params,
                    "sort": "id",
                    "order": "DESC",
                },
            )
        except Exception:
            data = await self._get("/Ticket", params=base_params)

        return data if isinstance(data, list) else []

    async def get_ticket(self, ticket_id: int) -> Dict[str, Any]:
        ticket_id = int(ticket_id)
        if ticket_id <= 0:
            return {}
        data = await self._get(
            f"/Ticket/{ticket_id}",
            params={"expand_dropdowns": "true"},
        )
        return data if isinstance(data, dict) else {}

    async def get_document(self, document_id: int) -> Dict[str, Any]:
        document_id = int(document_id)
        if document_id <= 0:
            return {}
        data = await self._get(
            f"/Document/{document_id}",
            params={"expand_dropdowns": "true"},
        )
        return data if isinstance(data, dict) else {}

    async def get_ticket_followups(self, ticket_id: int, *, limit: int = 100) -> List[Dict[str, Any]]:
        """Lista acompanhamentos/comentários (ITILFollowup) de um ticket (best-effort)."""
        ticket_id = int(ticket_id)
        limit = max(1, min(int(limit), 200))
        if ticket_id <= 0:
            return []

        paths = [
            f"/Ticket/{ticket_id}/ITILFollowup",
            f"/Ticket/{ticket_id}/ITILFollowup/",
            # alguns GLPIs expõem /TicketFollowup
            f"/Ticket/{ticket_id}/TicketFollowup",
            f"/Ticket/{ticket_id}/TicketFollowup/",
        ]

        data: Any = None
        for path in paths:
            try:
                data = await self._get(
                    path,
                    params={
                        "expand_dropdowns": "true",
                        "range": f"0-{limit - 1}",
                    },
                )
                break
            except Exception:
                continue

        if data is None:
            return []

        rows = self._normalize_list_payload(data)
        # tenta ordenar por date_mod desc (quando existir)
        def _sort_key(r: Dict[str, Any]):
            return str(r.get("date_mod") or r.get("date") or r.get("date_creation") or "")

        try:
            rows.sort(key=_sort_key, reverse=True)
        except Exception:
            pass
        return rows

    async def get_ticket_attachments(self, ticket_id: int, *, limit: int = 100) -> List[Dict[str, Any]]:
        """Lista anexos (Document_Item) vinculados ao ticket (somente leitura)."""
        ticket_id = int(ticket_id)
        limit = max(1, min(int(limit), 200))
        if ticket_id <= 0:
            return []

        paths = [
            f"/Ticket/{ticket_id}/Document_Item",
            f"/Ticket/{ticket_id}/Document_Item/",
        ]

        data: Any = None
        for path in paths:
            try:
                data = await self._get(
                    path,
                    params={
                        "expand_dropdowns": "true",
                        "range": f"0-{limit - 1}",
                    },
                )
                break
            except Exception:
                continue

        if data is None:
            return []

        rows = self._normalize_list_payload(data)
        return rows

    @staticmethod
    def _dropdown_str(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            for key in ("completename", "name", "value", "text"):
                v = value.get(key)
                if isinstance(v, str) and v.strip():
                    return v
            return ""
        return str(value)

    async def get_ticket_assigned_user_names(self, ticket_id: int) -> List[str]:
        """Retorna nomes dos usuários atribuídos (atores) do ticket (type=2).

        Observação: muitos GLPIs deixam users_id_assign vazio e usam Ticket_User.
        """
        ticket_id = int(ticket_id)
        if ticket_id <= 0:
            return []

        # Endpoint de sub-item é o mais comum.
        paths = [
            f"/Ticket/{ticket_id}/Ticket_User",
            f"/Ticket/{ticket_id}/Ticket_User/",
        ]

        data: Any = None
        last_error: Optional[Exception] = None
        for path in paths:
            try:
                data = await self._get(
                    path,
                    params={
                        "expand_dropdowns": "true",
                        # alguns GLPIs suportam range aqui; se ignorar, ok
                        "range": "0-199",
                    },
                )
                last_error = None
                break
            except Exception as e:
                last_error = e
                continue

        if data is None and last_error is not None:
            return []

        rows: List[Dict[str, Any]] = []
        if isinstance(data, list):
            rows = [x for x in data if isinstance(x, dict)]
        elif isinstance(data, dict):
            for key in ("data", "results", "items"):
                v = data.get(key)
                if isinstance(v, list):
                    rows = [x for x in v if isinstance(x, dict)]
                    break

        names: List[str] = []
        seen: set[str] = set()
        for row in rows:
            # type=2 => assigned
            try:
                row_type = int(row.get("type"))
            except Exception:
                row_type = None
            if row_type != 2:
                continue

            user_name = self._dropdown_str(row.get("users_id"))
            user_name = (user_name or "").strip()
            if not user_name:
                continue
            key = user_name.lower()
            if key in seen:
                continue
            seen.add(key)
            names.append(user_name)

        return names

    async def _try_search_user_id(self, username: str) -> Optional[int]:
        """Tenta achar users_id do GLPI usando /search/User (quando disponível)."""
        username = (username or "").strip()
        if not username:
            return None

        # Tentativa 1: searchText simples (algumas instalações suportam)
        try:
            data = await self._get(
                "/search/User",
                params={
                    "searchText": username,
                    "range": "0-49",
                },
            )
            uid = self._extract_user_id_from_search_payload(data, username)
            if uid:
                return uid
        except Exception:
            pass

        # Tentativa 2: criteria (field variando; best-effort)
        # Primeiro tenta equals para evitar falsos positivos.
        for field in ("1", "2", "5", "34"):
            try:
                data = await self._get(
                    "/search/User",
                    params={
                        "criteria[0][field]": field,
                        "criteria[0][searchtype]": "equals",
                        "criteria[0][value]": username,
                        "range": "0-49",
                    },
                )
                uid = self._extract_user_id_from_search_payload(data, username)
                if uid:
                    return uid
            except Exception:
                continue

        # Depois relaxa para contains.
        for field in ("1", "2", "5", "34"):
            try:
                data = await self._get(
                    "/search/User",
                    params={
                        "criteria[0][field]": field,
                        "criteria[0][searchtype]": "contains",
                        "criteria[0][value]": username,
                        "range": "0-49",
                    },
                )
                uid = self._extract_user_id_from_search_payload(data, username)
                if uid:
                    return uid
            except Exception:
                continue

        return None

    @staticmethod
    def _extract_user_id_from_search_payload(data: Any, username: str) -> Optional[int]:
        """Extrai um user id do payload do /search/User de forma tolerante."""
        username_l = (username or "").strip().lower()

        rows: List[Dict[str, Any]] = []
        if isinstance(data, dict):
            for key in ("data", "results", "items"):
                v = data.get(key)
                if isinstance(v, list):
                    rows = [x for x in v if isinstance(x, dict)]
                    break
        elif isinstance(data, list):
            rows = [x for x in data if isinstance(x, dict)]

        for row in rows:
            # Variações comuns: id em "id" ou "2" etc.
            raw_id = row.get("id")
            if raw_id is None:
                # tenta chaves numéricas comuns
                for k in ("2", "1", "0"):
                    if k in row:
                        raw_id = row.get(k)
                        break

            # tenta validar pelo nome/login em qualquer coluna
            hay = " ".join(str(v) for v in row.values() if v is not None).lower()
            if username_l and username_l not in hay:
                # Ainda pode ser válido, mas evita falsos positivos grosseiros.
                continue

            try:
                uid = int(str(raw_id).strip())
                if uid > 0:
                    return uid
            except Exception:
                continue
        return None

    async def find_user_id(self, *, username: str, email: Optional[str] = None) -> Optional[int]:
        """Resolve um usuário do GLPI (users_id) pelo username/email (best-effort)."""
        username = (username or "").strip()
        email = (email or "").strip() or None
        if not username and not email:
            return None

        # 1) tenta /search/User
        uid = await self._try_search_user_id(username or (email or ""))
        if uid:
            return uid

        # 2) fallback: lista /User e filtra em memória (pode ser pesado em GLPIs grandes)
        try:
            users = await self._get_list_paged(
                "/User",
                chunk_size=200,
                params={"expand_dropdowns": "true"},
                max_pages=5,
            )
        except Exception:
            users = []

        username_l = username.lower()
        email_l = email.lower() if email else ""

        # Passo 1: match exato (mais confiável)
        for u in users:
            if not isinstance(u, dict):
                continue
            try:
                uid = int(u.get("id"))
            except Exception:
                continue
            if uid <= 0:
                continue

            name = str(u.get("name") or "").strip().lower()
            login = str(u.get("login") or "").strip().lower()
            usern = str(u.get("username") or "").strip().lower()
            mail = str(u.get("email") or u.get("mail") or "").strip().lower()

            if username_l and username_l in {name, login, usern}:
                return uid
            if email_l and email_l == mail:
                return uid

        # Passo 2: match parcial (fallback)
        for u in users:
            if not isinstance(u, dict):
                continue
            try:
                uid = int(u.get("id"))
            except Exception:
                continue
            if uid <= 0:
                continue

            candidates = [
                u.get("name"),
                u.get("login"),
                u.get("username"),
                u.get("email"),
                u.get("mail"),
            ]
            cand_norm = " ".join(str(x or "") for x in candidates).strip().lower()
            if username_l and username_l in cand_norm:
                return uid
            if email_l and email_l in cand_norm:
                return uid

        return None

    async def assign_ticket_to_user(self, *, ticket_id: int, user_id: int) -> Tuple[bool, str]:
        """Adiciona um usuário como atribuído em um ticket no GLPI (best-effort).

        Retorna (ok, mensagem).
        """
        ticket_id = int(ticket_id)
        user_id = int(user_id)
        if ticket_id <= 0 or user_id <= 0:
            return False, "Parâmetros inválidos"

        def _httpx_detail(exc: Exception) -> str:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
                try:
                    body = exc.response.text
                except Exception:
                    body = ""
                body = (body or "").strip()
                suffix = f" - {body}" if body else ""
                return f"HTTP {exc.response.status_code}{suffix}"
            return str(exc)

        def _dropdown_str_local(value: Any) -> str:
            if value is None:
                return ""
            if isinstance(value, str):
                return value
            if isinstance(value, dict):
                for key in ("completename", "name", "value", "text"):
                    v = value.get(key)
                    if isinstance(v, str) and v.strip():
                        return v
                return ""
            return str(value)

        errors: List[str] = []

        def _is_duplicate_actor_error(exc: Exception) -> bool:
            if not isinstance(exc, httpx.HTTPStatusError) or exc.response is None:
                return False
            try:
                body = (exc.response.text or "").lower()
            except Exception:
                body = ""
            status = int(getattr(exc.response, "status_code", 0) or 0)
            if status not in {400, 409}:
                return False
            # GLPI/MySQL costuma retornar algo como Duplicate entry / already exists
            tokens = (
                "duplicate",
                "already",
                "exists",
                "doublon",
                "deja",
                "déjà",
                "ja existe",
                "já existe",
            )
            return any(t in body for t in tokens)

        # 1) Preferência: adicionar como ator atribuído (Ticket_User type=2).
        # Isso NÃO remove quem já está atribuído (comportamento desejado: "atribuir a mais").
        ticket_user_attempts: List[Tuple[str, Dict[str, Any]]] = [
            ("/Ticket_User", {"input": {"tickets_id": ticket_id, "users_id": user_id, "type": 2}}),
            ("/Ticket_User", {"input": [{"tickets_id": ticket_id, "users_id": user_id, "type": 2}]}),
            (f"/Ticket/{ticket_id}/Ticket_User", {"input": {"users_id": user_id, "type": 2}}),
            (f"/Ticket/{ticket_id}/Ticket_User", {"input": [{"users_id": user_id, "type": 2}]}),
            (f"/Ticket/{ticket_id}/Ticket_User/", {"input": {"users_id": user_id, "type": 2}}),
        ]

        for path, payload in ticket_user_attempts:
            try:
                await self._post(path, json=payload)
                return True, f"Usuário adicionado como atribuído (POST {path})"
            except Exception as e:
                if _is_duplicate_actor_error(e):
                    return True, "Usuário já estava atribuído (ator já existe)"
                errors.append(f"POST {path}: {_httpx_detail(e)}")

        # 2) Fallback (somente se ainda não houver um técnico principal): atualizar users_id_assign.
        # Evita sobrescrever um técnico já atribuído.
        current_has_primary = True
        try:
            t = await self.get_ticket(ticket_id)
            current_has_primary = bool(_dropdown_str_local(t.get("users_id_assign")).strip())
        except Exception:
            # se não conseguimos confirmar, assume que já tem alguém para não sobrescrever
            current_has_primary = True

        if current_has_primary:
            summary = " | ".join(errors[-6:]) if errors else "(sem detalhes)"
            return False, (
                "GLPI não aceitou adicionar como ator atribuído e o ticket já tem técnico principal. "
                f"Tentativas: {summary}"
            )

        # Tentativas: atualizar Ticket diretamente (variações de payload/rota)
        ticket_payloads: List[Tuple[str, Dict[str, Any]]] = [
            (f"/Ticket/{ticket_id}", {"input": {"users_id_assign": user_id}}),
            (f"/Ticket/{ticket_id}", {"input": {"id": ticket_id, "users_id_assign": user_id}}),
            (f"/Ticket/{ticket_id}", {"input": [{"id": ticket_id, "users_id_assign": user_id}]}),
            ("/Ticket", {"input": [{"id": ticket_id, "users_id_assign": user_id}]}),
            ("/Ticket", {"input": {"id": ticket_id, "users_id_assign": user_id}}),
            # Algumas instalações aceitam lista para users_id_assign
            (f"/Ticket/{ticket_id}", {"input": {"id": ticket_id, "users_id_assign": [user_id]}}),
        ]

        for path, payload in ticket_payloads:
            try:
                await self._put(path, json=payload)
                return True, f"Atribuído (PUT {path})"
            except Exception as e:
                errors.append(f"PUT {path}: {_httpx_detail(e)}")

        summary = " | ".join(errors[-6:]) if errors else "(sem detalhes)"
        return False, f"Não foi possível atribuir no GLPI. Tentativas: {summary}"

    async def add_ticket_followup(self, ticket_id: int, content: str) -> None:
        """Adiciona um followup/comentário em um ticket (best-effort)."""
        ticket_id = int(ticket_id)
        content = (content or "").strip()
        if ticket_id <= 0 or not content:
            return

        # Prefer: criar ITILFollowup diretamente (formato mais comum nas versões atuais)
        payload_a = {
            "input": {
                "itemtype": "Ticket",
                "items_id": ticket_id,
                "content": content,
            }
        }

        try:
            await self._post("/ITILFollowup", json=payload_a)
            return
        except httpx.HTTPStatusError:
            pass

        # Fallback: endpoint aninhado no ticket (algumas instalações usam essa rota)
        payload_b = {"input": {"content": content}}
        try:
            await self._post(f"/Ticket/{ticket_id}/ITILFollowup", json=payload_b)
        except httpx.HTTPStatusError:
            # Último fallback: alguns GLPIs expõem /TicketFollowup
            try:
                await self._post(f"/Ticket/{ticket_id}/TicketFollowup", json=payload_b)
            except httpx.HTTPStatusError:
                return

    async def add_ticket_solution(
        self,
        ticket_id: int,
        content: str,
        *,
        solution_type_id: Optional[int] = None,
    ) -> None:
        """Adiciona uma SOLUÇÃO em um ticket (best-effort).

        - Não altera o status do ticket.
        - Algumas instalações exigem `solutiontypes_id`.
        """
        ticket_id = int(ticket_id)
        content = (content or "").strip()
        if ticket_id <= 0 or not content:
            return

        base_input: Dict[str, Any] = {
            "itemtype": "Ticket",
            "items_id": ticket_id,
            "content": content,
        }
        if solution_type_id is not None and int(solution_type_id) > 0:
            base_input["solutiontypes_id"] = int(solution_type_id)

        # Prefer: criar ITILSolution diretamente
        try:
            await self._post("/ITILSolution", json={"input": dict(base_input)})
            return
        except httpx.HTTPStatusError:
            pass

        # Fallback 1: algumas instalações aceitam "solution" em vez de "content"
        alt_input = {k: v for k, v in base_input.items() if k != "content"}
        alt_input["solution"] = content
        try:
            await self._post("/ITILSolution", json={"input": alt_input})
            return
        except httpx.HTTPStatusError:
            pass

        # Fallback 2: endpoint aninhado no ticket
        try:
            await self._post(f"/Ticket/{ticket_id}/ITILSolution", json={"input": dict(base_input)})
        except httpx.HTTPStatusError:
            return

    async def get_computer(self, computer_id: int) -> Dict[str, Any]:
        """Busca detalhes de um computador"""
        data = await self._get(
            f"/Computer/{computer_id}",
            params={"expand_dropdowns": "true"},
        )
        return data if isinstance(data, dict) else {}

    async def get_computer_items(self, computer_id: int, item_type: str) -> List[Dict[str, Any]]:
        """Busca itens relacionados ao computador.

        Observação: o GLPI aplica paginação em várias rotas de listagem.
        Para evitar listas parciais (ex.: nem todos os pentes de RAM), pedimos
        um range grande.
        """
        path = f"/Computer/{int(computer_id)}/{str(item_type).strip()}"
        try:
            return await self._get_list_paged(
                path,
                chunk_size=200,
                params={"expand_dropdowns": "true"},
                max_pages=50,
            )
        except httpx.HTTPStatusError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                return []
            raise

    async def get_all_components(self, computer_id: int) -> Dict[str, List[Dict[str, Any]]]:
        """Busca todos os componentes de hardware do computador"""
        component_types = [
            "Item_DeviceProcessor",
            "Item_DeviceMemory",
            "Item_DeviceHardDrive",
            "Item_DeviceNetworkCard",
            "Item_DeviceGraphicCard",
            "Item_DeviceMotherboard",
            "Item_DevicePowerSupply",
            # Itens vinculados via glpi_computers_items (monitor, impressora, etc.)
            "Computer_Item",
        ]

        components: Dict[str, List[Dict[str, Any]]] = {}
        for comp_type in component_types:
            try:
                items = await self.get_computer_items(computer_id, comp_type)
                if items:
                    components[comp_type] = items
            except Exception as e:
                print(f"Erro ao buscar {comp_type}: {e}")
                continue

        return components
