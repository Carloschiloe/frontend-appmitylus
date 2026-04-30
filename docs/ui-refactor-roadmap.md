# UI Refactor Roadmap — Mitynex

## Objetivo
Dejar toda la aplicación con una sola línea visual, consistente con el kit de marca `Mitynex_Kit_Original_Corregido`, usando componentes reutilizables, menos CSS duplicado y cero estilos muertos o inline innecesarios.

## Fuente oficial de marca
- Kit visual base: `C:\Users\carlo\Desktop\Appmmpp 20Abr\Mitynex_Kit_Original_Corregido`
- Guía visual: `00_guia_visual_referencia_original.png`
- Paleta oficial:
  - Azul profundo: `#0B3C5D`
  - Aqua: `#00A8A8`
  - Gris claro: `#F4F6F8`
  - Gris texto: `#4A5568`
- Tipografía: `Inter`

## Assets oficiales a usar en frontend
- Header / pantallas claras: `17_logo_horizontal_con_slogan_transparente.png`
- Fondos oscuros: `05_logo_horizontal_con_slogan_fondo_oscuro.png`
- Ícono / avatar / favicon base: `19_solo_icono_transparente.png`

## Diagnóstico actual
### Base ya aprovechable
- `css/tokens.css`
- `css/base-ui.css`
- `css/app-shell.css`
- `css/sidebar.css`
- `css/modals-modern.css`

### Deuda visual detectada
- Biomasa tiene buen lenguaje visual, pero gran parte está embebida en `html/Biomasa/index.html`.
- Existen varios CSS por módulo con patrones repetidos para:
  - tablas
  - filtros
  - tabs
  - cards KPI
  - modales
- Hay vistas con `<style>` inline todavía activas:
  - `html/Biomasa/index.html`
  - `html/Abastecimiento/contactos/contactos.html`
  - `html/Abastecimiento/historial/index.html`
  - `html/Usuarios/index.html`
  - `html/login.html`

## Arquitectura objetivo
### 1. Capa de tokens
Archivo fuente:
- `css/tokens.css`

Debe concentrar:
- colores de marca
- radios
- sombras
- spacing
- tipografía
- estados semánticos
- aliases de compatibilidad temporales

### 2. Capa de shell
Archivos:
- `css/app-shell.css`
- `css/sidebar.css`
- `css/index-modern.css`

Responsabilidad:
- layout general
- sidebar
- hero/header
- contenedores de contenido
- comportamiento responsive base

### 3. Capa de componentes
Archivos a consolidar:
- `css/base-ui.css`
- `css/mmpp-ui.css`
- `css/modals-modern.css`

Responsabilidad:
- botones
- cards
- tabs
- badges / pills
- tablas base
- filtros / toolbars
- dropdowns / popovers
- empty states
- modales

### 4. Capa de módulos
Archivos por vista:
- `css/centros-modern.css`
- `css/sanitario.css`
- `css/contactos.css`
- `css/contactos-tabla.css`
- `css/interacciones.css`
- `css/tratos.css`
- `css/calendario.css`
- `css/resumen-semanal.css`
- `css/configuracion.css`
- `css/maestros.css`

Regla:
- aquí solo debe vivir lo específico del módulo
- no redefinir botones, tabs, tablas o cards si ya existen en sistema

## Qué mantener
- `tokens.css` como fuente única de marca
- `base-ui.css` como base de componentes
- `modals-modern.css` como base de modales
- `centros-modern.css` y `sanitario.css` como primeras referencias del nuevo estilo

## Qué refactorizar primero
### Fase 1 — Sistema visual base
1. Consolidar tokens con la guía oficial
2. Definir assets oficiales de logo e ícono
3. Extraer patrones reutilizables desde Biomasa hacia CSS compartido
4. Eliminar estilos inline críticos

### Fase 2 — Centros y Sanitario
Objetivo:
- dejar ambas vistas como referencia “golden path”
- tablas, filtros, cards, tabs y modales 100% consistentes

### Fase 3 — Biomasa
Objetivo:
- mover estilos inline a CSS modular
- convertir Biomasa en consumidor del sistema, no en excepción

### Fase 4 — Abastecimiento / Contactos / Interacciones
Objetivo:
- unificar tablas, toolbars, pills, cards y modales
- reducir CSS duplicado

### Fase 5 — Maestros / Usuarios / Configuración / Login
Objetivo:
- cerrar bordes visuales
- aplicar branding final
- revisar responsive y vacíos visuales

## Componentes que deben salir del sistema
### Shell
- `am-page-shell`
- `am-page-hero`
- `am-page-actions`

### Navegación
- `am-tabs`
- `am-tab`

### KPIs
- `am-kpi-grid`
- `am-kpi-card`

### Filtros
- `am-toolbar`
- `am-search`
- `am-filter-trigger`
- `am-filter-popover`
- `am-filter-chip`

### Tablas
- `am-table-shell`
- `am-table`
- `am-table-row-actions`
- `am-status-badge`
- `am-cell-meta`

### Modales
- `am-modal`
- `am-modal-header`
- `am-modal-body`
- `am-modal-footer`

## Decisiones de marca
- El ícono “AM” actual no debe seguir siendo el rostro principal de la app.
- La app debe pasar a usar Mitynex como marca visible y consistente.
- El color teal debe usarse como acento, no como fondo dominante universal.
- El azul profundo debe dominar shell, navegación y encabezados.

## Regla de oro de implementación
Antes de agregar CSS nuevo:
1. revisar `tokens.css`
2. revisar `base-ui.css`
3. revisar `mmpp-ui.css`
4. revisar si el patrón ya existe en Centros / Sanitario

Si ya existe, se reutiliza o se extrae.

## Criterios de término
- Una sola familia de tabs en toda la app
- Una sola familia de tablas en toda la app
- Un solo sistema de filtros
- Un solo sistema de modales
- Un solo lenguaje de badges/estados
- Cero estilos inline relevantes
- Cero logos inconsistentes entre vistas principales
