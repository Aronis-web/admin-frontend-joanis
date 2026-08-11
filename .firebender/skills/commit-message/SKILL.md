---
name: commit-message
description: Genera mensajes de commit en español siguiendo el estilo del proyecto ERP-aio. Úsalo cuando el usuario pida crear un commit, redactar un mensaje de commit, o esté por hacer commit-push.
version: 1.0.0
---

# Commit message (estilo ERP-aio)

## Reglas

- **Idioma**: español.
- **Modo**: imperativo, presente. No "agregado", no "agregando" → "agrega".
- **Sin prefijos tipo Conventional Commits** (`feat:`, `fix:`) salvo que el usuario lo pida explícitamente.
- **Longitud**: subject ≤72 caracteres.
- **Foco**: explica el **por qué** o el efecto de negocio, no el "qué" obvio del diff.
- Si hay varios cambios cohesivos, agruparlos en una sola frase.
- Si hay cambios muy distintos, sugerir al usuario partir en varios commits.

## Pasos

1. `git --no-pager diff --cached` y `git --no-pager diff` para ver los cambios.
2. `git --no-pager log -5 --oneline` para entender el estilo histórico del repo.
3. Redactar 1 línea subject + opcionalmente 1–3 bullets de contexto si hace falta.
4. Mostrar el mensaje al usuario antes de ejecutar el commit.

## Ejemplos buenos

- `corrige invalidacion de cache en useStock al recibir transferencias`
- `optimiza carga de detalle de campaña reduciendo refetchs innecesarios`
- `agrega endpoint de notas de credito desde admin/sales`
- `arregla overflow visual de tabla de cuadre en pantallas pequeñas`

## Ejemplos malos

- `cambios en repartos` (vago)
- `feat: add new feature` (inglés + prefijo no usado)
- `actualicé el código de campañas` (pasado, vago)
- `WIP` (no informa)
