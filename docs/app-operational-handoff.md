# App Operational Handoff

Status: `handoff operativo`
Updated: `2026-05-06`
Read together with:
- `frontend-appmitylus-main/docs/gestion-biomasa-replatform-plan.md`

## Purpose
Este documento explica:
- que hace la aplicacion
- como debe funcionar segun las decisiones ya tomadas
- que partes ya fueron reconfiguradas
- que pendientes estructurales quedan

Su objetivo es que otra IA pueda retomar el trabajo sin perder contexto funcional.

## Executive summary
La aplicacion gestiona abastecimiento de biomasa desde una operacion de terreno.

Antes mezclaba tres cosas:
- seguimiento comercial de proveedores
- estado real de la biomasa
- historial de eventos

La reconfiguracion ya avanzó bastante y el modelo correcto ahora es:
- `Gestion` = seguimiento humano y agenda
- `Biomasa` = situacion de la materia prima
- `Historial` = memoria de lo que ya ocurrio

## Technical shape
- frontend: `React + Vite`
- backend: `Express + Mongo`
- arquitectura multiempresa / multitenant
- repos activos:
  - `frontend-appmitylus-main`
  - `backend-appmitylus-main`

## Core business model

### 1. Proveedor
Es la contraparte comercial.
No equivale necesariamente a un contacto ni a un centro.

El proveedor puede tener:
- uno o varios contactos
- uno o varios centros
- uno o varios casos de seguimiento
- una o varias etapas de biomasa
- uno o varios programas de cosecha en el tiempo

### 2. Contacto
Es la persona con quien se habla.
Debe poder quedar asociado a:
- una empresa / proveedor
- opcionalmente un centro especifico de ese proveedor

Hoy eso ya se puede editar desde `Gestion > Proveedores > Contactos` con:
- buscador visual por nombre de proveedor o codigo de centro
- seleccion de proveedor
- despliegue dependiente de centros asociados

### 3. Centro
Es la unidad operativa o centro de cultivo asociado al proveedor.
La relacion `centro -> proveedor` nace desde el modulo `Centros`.

Cambios estructurales ya aplicados:
- si cambia el nombre del proveedor desde un centro base, el rename se propaga a contactos, oportunidades, interacciones, visitas, muestreos, disponibilidades, semi cerrados y programas
- si cambia `codigo` o `comuna` de un centro, se resincronizan los campos denormalizados ligados al centro en contactos, oportunidades, biomasa y programas
- un centro no se puede eliminar si mantiene contactos, oportunidades activas o programas activos/pausados
- `Centros > Directorio` ya permite crear y editar centros desde modal

### 4. Seguimiento comercial
Es la capa humana de gestion.
Responde:
- con quien debo hacer algo
- que debo hacer
- cuando
- por que no lo sigo ahora

La fuente de verdad actual para esta capa es `OportunidadAbastecimiento` extendida.

### 5. Biomasa
Es la situacion real de la materia prima.
Responde:
- si hay biomasa o no
- si esta en conversacion, reservada, acordada, perdida o ejecutada

### 6. Programa
Es una etapa operativa de ejecucion de cosecha.
No representa toda la vida del proveedor.

Un proveedor puede tener varios programas distintos si cambian:
- vigencia
- centro
- volumen
- condiciones operativas o comerciales

Protecciones ya aplicadas:
- un programa finalizado se puede reabrir solo si no tiene continuidad creada
- un programa con continuidad creada no se puede eliminar

## Functional design by module

## Gestion

### Goal
Ordenar el trabajo diario de seguimiento.

### What Gestion should answer
- a quien debo contactar
- que sigue
- que esta pausado
- que ya no debo seguir

### Current intended tabs
- `Resumen`
- `Agenda`
- `Proveedores`
- `Historial`

### Legacy routes still available
Las rutas antiguas siguen existiendo para no romper compatibilidad interna:
- `Interacciones`
- `Tratos` -> redirige a `Biomasa > Negociacion`
- el destino recomendado para editar o crear acuerdos ya es `Biomasa > Negociacion > Gestion comercial`
- `Muestreos` -> redirige a `Biomasa > Muestreos`

Regla funcional actual:
- `Interacciones` se mantiene visible como herramienta de registro operativo
- la vista oficial de supervisiÃ³n del trabajo del equipo vive en `Historial > Actividad del equipo`
- `Tratos` y `Muestreos` sÃ­ dejaron de vivir como centro funcional de `Gestion`

### Seguimiento states
Estados visibles y aprobados:
- `Activo`
- `Pausado`
- `Cerrado`
- `Acordado`

### Seguimiento rules
`Activo`
- exige proxima accion + fecha
- aparece en agenda

`Pausado`
- exige motivo + fecha revision + proxima accion
- no debe molestar hasta la fecha indicada

`Cerrado`
- exige motivo de cierre
- no vuelve a aparecer como pendiente

`Acordado`
- sale de Gestion
- pasa a flujo comercial / biomasa

### Pause reasons
- `Esperando crecimiento`
- `Esperando disponibilidad`
- `Esperando respuesta`
- `Esperando resultado de muestra`
- `Esperando decision interna`

### Close reasons
- `Vendido a otro`
- `Sin biomasa`
- `Descartado`
- `No califica`
- `Sin respuesta`
- `No interesa`

### Removed concepts
No reintroducir:
- `En riesgo`
- `Fuera de temporada`

### Quick capture
Existe un flujo movil de `Registro rapido` con boton flotante global.

Debe permitir registrar en pocos pasos:
- proveedor
- que paso
- resultado del seguimiento

Si corresponde, pide:
- proxima accion
- fecha
- motivo de pausa
- motivo de cierre

## Proveedores

### Goal
Ver contexto de empresa, contacto principal, seguimiento actual y proxima accion.

### Current behavior
`Gestion > Proveedores` consolida:
- directorio / centros
- contactos
- oportunidades
- interacciones

Muestra por fila:
- proveedor
- contacto principal
- seguimiento
- ultima interaccion
- proxima accion

La accion `Ver centros` ya navega a `Centros > Directorio` con filtro aplicado por proveedor.

### Contacts
`Editar Contacto` ya usa:
- buscador visual de empresa asociada
- busqueda por nombre proveedor o codigo centro
- seleccion dependiente de centro asociado

## Historial

### Goal
Ser expediente y memoria, no agenda.

### Current intended behavior
`Historial` debe mostrar:
- cronologia por proveedor
- interacciones
- visitas
- cambios de seguimiento
- contactos

No debe empujar tareas pendientes.

### Vista para jefaturas
`Historial` ya debe cumplir dos roles visibles:
- `Expediente`
- `Actividad del equipo`

`Actividad del equipo` es la vista oficial para supervisión de jefaturas.
Ahí se debe ver:
- quién llamó
- quién visitó
- quién tomó muestras
- qué proveedor gestionó cada persona
- qué resultado tuvo
- qué próxima acción dejó

`Interacciones` no debe eliminarse como concepto.
Su rol correcto es:
- registrar gestiones puntuales
- permitir carga manual
- servir de apoyo operativo al equipo de abastecimiento

La lectura consolidada para jefaturas no debe depender de esa pestaÃ±a aislada, sino de `Actividad del equipo`.

## Biomasa

### Goal
Representar situacion real de la materia prima.

### Current intended sections
- `Disponibilidad`
- `Negociacion`
- `Programa`
- `Muestreos`

Estado actual de navegacion:
- `Muestreos` ya esta visible como pestaña principal dentro de `Biomasa`
- `Tratos` ya no debe usarse como destino principal desde `Gestion`; la operacion equivalente vive en `Biomasa > Negociacion`

### Biomasa visible states
Estados visibles aprobados:
- `Disponible`
- `En evaluacion`
- `En conversacion`
- `Reservada`
- `Acordada`
- `Vendida a otro`
- `Sin biomasa`
- `Descartada`

Nota:
- la UI ya usa `En conversacion`, `Reservada`, `Acordada`
- los estados tecnicos legacy del trato aun pueden ser `negociando`, `semi_acordado`, `acordado`
- la UI debe seguir ocultando esa complejidad

### Biomasa > Disponibilidad
Muestra stock o biomasa disponible por periodo.

### Biomasa > Negociacion
Debe separar claramente tres grupos:
- `Biomasa comercial pendiente`
- `Biomasa vinculada a programa`
- `Biomasa perdida o descartada`

Eso ya esta implementado.

La vinculacion entre modulos hoy debe leerse asi:
- un contacto puede arrastrar empresa y centro a una oportunidad
- la oportunidad puede alimentar biomasa negociable
- la biomasa puede pasar a programa
- el programa debe conservar el centro asociado cuando exista

#### Biomasa comercial pendiente
Contiene biomasa:
- en conversacion
- reservada
- acordada
pero aun no programada

#### Biomasa vinculada a programa
Contiene biomasa ya enlazada a un programa.
La tabla debe mostrar:
- situacion biomasa
- estado del programa
- toneladas
- vigencia

Estados de programa visibles:
- `Programada`
- `Programada pausada`
- `Ejecutada`

#### Biomasa perdida o descartada
Contiene cierres reales como:
- `Vendida a otro`
- `Sin biomasa`
- `Descartada`
- `No califica`

## Programa

### Goal
Operar etapas concretas de cosecha.

### Important conceptual rule
`Programa` no es un contenedor eterno.
Es una etapa operativa con:
- vigencia
- centro
- camiones por dia
- toneladas estimadas
- condiciones

### When to edit same program
Solo para ajustes operativos menores:
- dias de cosecha
- camiones por dia
- nota
- pausa temporal
- ajuste menor de toneladas

### When to close and create new program
Si cambia el marco del acuerdo:
- vigencia
- centro
- volumen relevante
- condiciones comerciales
- corte del suministro y reinicio posterior

### Current implemented flow
Cada fila de `Biomasa > Programa` ya puede:
- pausar
- reactivar si estaba pausado
- finalizar
- finalizar y crear nuevo
- reabrir si quedo finalizado por error
- editar
- eliminar

### Program close semantics
`Finalizar programa` ya no significa siempre `ejecutado`.

Ahora depende del motivo:
- `cumplido` -> la biomasa queda `ejecutada`
- `sin_biomasa` -> la biomasa sale como cierre real / perdida
- `cambio_condiciones`, `pausa_operacional`, `reemplazado_por_nuevo` -> la biomasa no queda ejecutada; vuelve a una situacion comercial coherente o pasa a continuidad

`Finalizar y crear nuevo` solo debe usarse para:
- `cambio_condiciones`
- `pausa_operacional`
- `reemplazado_por_nuevo`

### Program close reasons
Ya definidos:
- `cumplido`
- `cambio_condiciones`
- `sin_biomasa`
- `pausa_operacional`
- `reemplazado_por_nuevo`

### Current reopen rule
Un programa finalizado puede reabrirse si:
- no tiene continuidad creada

No puede reabrirse si:
- ya existe un programa hijo o continuidad

### Continuity behavior
Si se usa `Finalizar y crear nuevo`:
- se cierra el actual
- se abre un nuevo modal prellenado
- el nuevo guarda `programaAnteriorId`

### Current UI hints in Programa
La tabla ya puede mostrar:
- `Continuacion de etapa anterior`
- `Tiene continuidad creada`
- `Cierre: ...`

### Missing ideal long-term improvements
Seria bueno mas adelante mostrar:
- enlace a programa anterior
- enlace a programa siguiente
- motivo de cierre con mas contexto
- centro real si aplica

## Current automation map

### Between Gestion and Biomasa
Ya existe una separacion fuerte:
- Gestion decide seguimiento humano
- Biomasa decide situacion de materia prima

### Between Biomasa and Programa
Ya existe sincronizacion:
- si se crea programa, la biomasa queda vinculada a programa
- si se finaliza programa, la biomasa puede pasar a ejecutada
- si se reabre programa sin continuidad, se revierte ese cierre operativo

## What is already solved
- separacion conceptual entre Gestion, Biomasa e Historial
- eliminacion de `En riesgo`
- eliminacion de `Fuera de temporada`
- seguimientoEstado en backend
- flujo movil rapido
- vistas nuevas de Resumen, Agenda, Proveedores, Historial
- separacion de Biomasa comercial pendiente vs vinculada a programa
- cierre por etapa en Programa
- continuidad de programas
- reapertura segura de programas finalizados

## Executive pending list

### Critical
1. hacer prueba operativa completa de punta a punta:
   - crear proveedor / contacto
   - registrar gestion
   - cerrar por sin biomasa o vendido a otro
   - acordar biomasa
   - crear programa
   - pausar / reactivar / finalizar
   - reabrir o continuar
   - revisar impacto en Historial y Biomasa

2. validar que no queden inconsistencias entre:
   - oportunidad
   - biomasa
   - programa

### Important
3. cerrar de mejor forma la relacion:
   - proveedor
   - empresa
   - centro
   - contacto

4. revisar duplicidades o filas repetidas en `Programa`

5. terminar la limpieza de labels visibles de `Biomasa` y `Programa` donde aun sobrevivan textos heredados

### Desirable
6. mostrar trazabilidad richer entre programas:
   - anterior
   - continuidad
   - motivo de cierre

7. terminar de validar centros historicos en programas viejos y oportunidades creadas antes de la resincronizacion

## What another AI should not change without discussion
- no reintroducir `En riesgo`
- no volver a mezclar Gestion con Biomasa
- no usar un solo programa eterno para un proveedor
- no usar `Interacciones` o `Tratos` como fuente de verdad del seguimiento

## Recommended next work order
1. ejecutar prueba funcional completa
2. corregir incoherencias encontradas
3. terminar de validar la relacion proveedor / empresa / centro / contacto con datos reales e historicos
4. recien despues limpiar detalles menores

## Continuity prompt
```text
Read first:
- frontend-appmitylus-main/docs/gestion-biomasa-replatform-plan.md
- frontend-appmitylus-main/docs/app-operational-handoff.md

This app manages provider follow-up, biomass situation, and harvest programs.

Non-negotiables:
- Gestion = human follow-up
- Biomasa = biomass situation
- Historial = past events
- Programa = one operational stage, not the whole life of a provider
- no reintroduce "En riesgo"
- no reintroduce "Fuera de temporada"

Critical pending items:
1. run full end-to-end operational validation
2. fix any inconsistency between oportunidad, biomasa and programa
3. tighten provider / company / center / contact relations

When implementing:
- preserve mobile-first behavior
- preserve quick capture
- preserve program continuity and safe reopen rules
- document any new rule in both docs
```
