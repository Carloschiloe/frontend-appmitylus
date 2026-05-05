# Gestion + Biomasa Replatform Plan

Status: `draft operativo`
Updated: `2026-05-04`
Scope: `frontend-appmitylus-main + backend-appmitylus-main`

## Purpose
- separar seguimiento comercial de estado de biomasa
- simplificar la experiencia en movil y terreno
- dejar una hoja de ruta que otra IA pueda retomar sin perder contexto

## Core problem
Hoy la app mezcla:
- seguimiento comercial
- estado de biomasa
- historial operativo

Eso genera:
- pendientes falsos
- estados ambiguos
- demasiadas pestanas internas
- captura lenta para uso en terreno

## Product goal
La app debe permitir:
- registrar una gestion en 20-30 segundos
- entender inmediatamente a quien contactar hoy
- distinguir claramente seguimiento humano vs biomasa
- cerrar bien un proveedor para que no vuelva a ensuciar la agenda

## Non-negotiables
- simplicidad extrema
- mobile first real
- una sola fuente de verdad por capa
- automatizacion solo cuando reduzca friccion

## Strategic decision
Primero arreglar `Gestion`, luego `Biomasa`.

Motivo:
- hoy el principal dolor operativo esta en la agenda y los pendientes
- si Gestion sigue confundida, Biomasa seguira contaminando la operacion

## Final conceptual model

### Gestion
Responde:
- con quien debo hacer algo
- que debo hacer
- cuando
- por que no lo sigo ahora

### Biomasa
Responde:
- cual es la situacion de la materia prima
- si esta disponible, negociada, acordada o perdida
- por que se perdio o descarto

### Historial
Responde:
- que ya paso con este proveedor/caso

## Recommended source of truth
En Fase 1 se recomienda extender `OportunidadAbastecimiento` en vez de crear una entidad nueva.

Campos sugeridos:
- `seguimientoEstado`
- `motivoPausa`
- `motivoCierre`
- `proximaAccion`
- `fechaProximaAccion`
- `fechaRevision`
- `reabierto`

## Gestion states
- `Activo`
- `Pausado`
- `Cerrado`
- `Acordado`

### Meaning
`Activo`
- hay una accion pendiente
- exige proxima accion + fecha

`Pausado`
- no debe aparecer como urgente hasta cierta fecha
- exige motivo + fecha revision + proxima accion

`Cerrado`
- no hay mas seguimiento comercial que hacer
- exige motivo de cierre

`Acordado`
- sale del seguimiento y pasa al flujo comercial/biomasa

## Pause reasons
- `Esperando crecimiento`
- `Esperando disponibilidad`
- `Esperando respuesta`
- `Esperando resultado de muestra`
- `Esperando decision interna`

## Close reasons
- `Vendido a otro`
- `Sin biomasa`
- `Descartado`
- `No califica`
- `Sin respuesta`
- `No interesa`
- `Acordado`

Explicitly removed:
- `En riesgo`
- `Fuera de temporada`

## Biomasa states
Estados visibles recomendados:
- `Disponible`
- `En evaluacion`
- `En negociacion`
- `Acordada`
- `Vendida a otro`
- `Sin biomasa`
- `Descartada`

No usar `Sin informacion` como estado de negocio. Si hace falta, mostrarlo solo como ausencia de registro.

## Automation rules
- `Activo` exige proxima accion + fecha
- `Pausado` exige motivo + fecha revision + proxima accion
- `Cerrado` exige motivo de cierre
- `Acordado` sale de agenda de Gestion
- un caso `Cerrado` no vuelve a bandeja por una actividad historica, solo si el usuario lo reabre

### Agenda rules
- la agenda muestra solo `Activos`
- los `Pausados` aparecen al llegar la fecha de revision
- los `Cerrados` nunca aparecen
- los `Acordados` no aparecen en seguimiento

### Biomasa rules
- `Tome muestra` puede mover biomasa a `En evaluacion`
- `Vendida a otro`, `Sin biomasa` y `Descartada` no generan pendientes humanos automaticos

## Target navigation

### Gestion
Dejar solo:
- `Resumen`
- `Agenda`
- `Proveedores`
- `Historial`

Mover fuera del primer nivel:
- `Interacciones`
- `Calendario`
- `Tratos`

### Biomasa
Dejar:
- `Disponibilidad`
- `Negociacion`
- `Muestreos`
- `Programa`

## Mobile-first capture flow
La captura en terreno debe resolverse en 3 pasos.

### Paso 1
Seleccionar proveedor.

### Paso 2
Elegir que ocurrio:
- `Llame`
- `Visite`
- `WhatsApp`
- `Tome muestra`
- `Negocie`
- `Sin producto`
- `Vendio a otro`
- `Acordado`

### Paso 3
Elegir resultado:
- `Seguir`
- `Pausar`
- `Cerrar`
- `Acordar`

La app pide solo lo minimo segun la decision.

## Minimum required data in terrain
Siempre obligatorios:
- `Proveedor`
- `Que paso`
- `Resultado del seguimiento`

Condicionales:
- si `Seguir`: proxima accion + fecha
- si `Pausar`: motivo pausa + fecha revision + proxima accion
- si `Cerrar`: motivo cierre
- si `Acordar`: confirmacion minima y paso al flujo comercial

## Main mobile entrypoint
Usar un boton flotante global de captura rapida.
Si el usuario entra desde la ficha del proveedor, abrir prellenado.

## Recommended implementation order

### Phase 0
- validar este modelo funcional

### Phase 1
- extender `OportunidadAbastecimiento`
- definir validaciones por `seguimientoEstado`
- preparar contratos API simples

### Phase 2
- construir flujo rapido movil
- endpoint combinado para registrar evento + actualizar seguimiento

### Phase 3
- rehacer `Resumen`, `Agenda`, `Proveedores`, `Historial`

### Phase 4
- desacoplar Biomasa de Gestion

### Phase 5
- limpieza, textos y automatizaciones finas

## Live checklist

### Phase 0
- [ ] estados de Gestion aprobados
- [ ] motivos de pausa aprobados
- [ ] motivos de cierre aprobados
- [ ] estados de Biomasa aprobados
- [ ] nueva navegacion aprobada

### Phase 1
- [ ] fuente de verdad del seguimiento definida
- [ ] campos nuevos creados en backend
- [ ] validaciones por estado implementadas
- [ ] contratos API documentados

### Phase 2
- [ ] flujo movil rapido disenado
- [ ] flujo movil implementado
- [ ] endpoint combinado disponible
- [ ] prueba real de uso en movil realizada

### Phase 3
- [ ] resumen nuevo implementado
- [ ] agenda nueva implementada
- [ ] ficha de proveedor simplificada
- [ ] historial limpio separado

### Phase 4
- [ ] biomasa desacoplada
- [ ] estados visibles consistentes
- [ ] perdidas de biomasa reflejadas correctamente

### Phase 5
- [ ] textos finales revisados
- [ ] navegacion final simplificada
- [ ] automatizaciones finas validadas

## Continuity prompt
```text
You are resuming the Gestion/Biomasa replatform work.

Read first:
frontend-appmitylus-main/docs/gestion-biomasa-replatform-plan.md

Already decided:
- separate seguimiento comercial from estado de biomasa
- remove "En riesgo"
- remove "Fuera de temporada"
- "Pausado" requires motivo + fecha revision + proxima accion
- fix Gestion first, then Biomasa
- use OportunidadAbastecimiento as the Phase 1 source of truth
- keep Gestion to 4 tabs
- keep Biomasa to 7 visible states
- use a global floating quick-capture entrypoint
- require only Proveedor + Que paso + Resultado del seguimiento in terrain

When continuing:
1. check the checklist
2. continue from the first incomplete phase
3. do not reintroduce ambiguous states
4. document new decisions in this same file
5. think mobile-first before any UI decision
```
