# Gestion + Biomasa Replatform Plan

Status: `draft operativo`
Updated: `2026-05-06`
Scope: `frontend-appmitylus-main + backend-appmitylus-main`
Companion handoff:
- `frontend-appmitylus-main/docs/app-operational-handoff.md`

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

Tambien debe responder, para jefaturas:
- quien llamo
- quien visito
- quien tomo muestras
- que resultado obtuvo el equipo
- que proxima accion dejo cada gestion

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
- si cambia empresa/proveedor desde el maestro de centros, el rename debe propagarse a las colecciones relacionadas
- si cambia codigo o comuna de centro, el contexto denormalizado debe resincronizarse aguas abajo
- no se debe permitir eliminar un centro con contactos, oportunidades activas o programas activos/pausados

### Agenda rules
- la agenda muestra solo `Activos`
- los `Pausados` aparecen al llegar la fecha de revision
- los `Cerrados` nunca aparecen
- los `Acordados` no aparecen en seguimiento

### Biomasa rules
- `Tome muestra` puede mover biomasa a `En evaluacion`
- `Vendida a otro`, `Sin biomasa` y `Descartada` no generan pendientes humanos automaticos
- `Programa` representa una etapa operativa cerrada, no toda la vida del proveedor
- si cambian condiciones base del programa, se debe `finalizar` la etapa actual y `crear un programa nuevo`
- si solo cambian ajustes operativos menores, se puede editar el mismo programa
- `finalizar programa` no siempre significa `ejecutado`: `cumplido` ejecuta, `sin_biomasa` cierra como perdida, y `cambio_condiciones` / `pausa_operacional` / `reemplazado_por_nuevo` mantienen la biomasa operativamente coherente para continuidad

### Program rules
Editar el mismo programa:
- ajuste menor de dias de cosecha
- ajuste menor de camiones por dia
- nota o observacion
- pausa temporal dentro de la misma etapa

Finalizar y crear nuevo:
- cambio de vigencia
- cambio relevante de volumen
- cambio de condiciones comerciales u operativas
- corte del suministro y reinicio posterior
- cambio de centro o reconfiguracion material del acuerdo

Resguardos implementados:
- `reabrir programa` solo si no existe continuidad creada
- `eliminar programa` bloqueado si ya existe continuidad creada

## Target navigation

### Gestion
Dejar solo:
- `Resumen`
- `Agenda`
- `Proveedores`
- `Historial`

Mantener visible como herramienta operativa:
- `Interacciones`

Mover fuera del primer nivel central:
- `Calendario`
- `Tratos`

Estado de transicion ya aplicado:
- `Interacciones` sigue visible como herramienta de registro del equipo
- la vista oficial para supervisiÃ³n y jefaturas es `Historial > Actividad del equipo`
- `Tratos` legacy redirige a `Biomasa > Negociacion`
- `Tratos` legacy ya abre la subvista `Gestion comercial` dentro de `Biomasa > Negociacion`
- `Muestreos` legacy redirige a `Biomasa > Muestreos`
- `Muestreos` ya esta visible como navegacion principal dentro de `Biomasa`

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

Implementado adicionalmente:
- resincronizacion `Contacto -> Oportunidad` con proveedor y centro
- navegacion `Gestion > Proveedores -> Ver centros` con filtro aplicado sobre `Centros > Directorio`
- `Centros > Directorio` con alta/edicion de centros desde modal

#### Phase 1 API contract
Nuevo endpoint base:
- `PATCH /oportunidades/:id/seguimiento`

Body segun estado:
- `activo`
  - `seguimientoEstado: "activo"`
  - `proximaAccion`
  - `fechaProximaAccion`
  - `observacion` opcional
- `pausado`
  - `seguimientoEstado: "pausado"`
  - `motivoPausa`
  - `fechaRevision`
  - `proximaAccion`
  - `observacion` opcional
- `cerrado`
  - `seguimientoEstado: "cerrado"`
  - `motivoCierre`
  - `observacion` opcional
- `acordado`
  - `seguimientoEstado: "acordado"`
  - `observacion` opcional

Compatibilidad:
- el backend mantiene `estado` por compatibilidad con vistas actuales
- el backend expone ademas:
  - `seguimientoEstado`
  - `motivoPausa`
  - `motivoCierre`
  - `proximaAccion`
  - `fechaProximaAccion`
  - `fechaRevision`
  - `reabierto`
- `GET /oportunidades` ahora puede filtrar por `seguimientoEstado`
- los cierres nuevos sincronizan un estado legacy compatible para no romper tratos ni dashboards existentes

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
- [x] estados de Gestion aprobados
- [x] motivos de pausa aprobados
- [x] motivos de cierre aprobados
- [x] estados de Biomasa aprobados
- [x] nueva navegacion aprobada

### Phase 1
- [x] fuente de verdad del seguimiento definida
- [x] campos nuevos creados en backend
- [x] validaciones por estado implementadas
- [x] contratos API documentados

### Phase 2
- [x] flujo movil rapido disenado
- [x] flujo movil implementado
- [x] endpoint combinado disponible
- [ ] prueba real de uso en movil realizada

### Phase 3
- [x] resumen nuevo implementado
- [x] agenda nueva implementada
- [x] ficha de proveedor simplificada
- [x] historial limpio separado

### Phase 4
- [x] biomasa desacoplada
- [x] estados visibles consistentes
- [x] perdidas de biomasa reflejadas correctamente

### Phase 5
- [ ] textos finales revisados
- [x] navegacion final simplificada
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

## Progress log

### 2026-05-04
- se extendio `OportunidadAbastecimiento` con los campos de seguimiento
- se implemento validacion por `activo`, `pausado`, `cerrado` y `acordado`
- se creo `PATCH /oportunidades/:id/seguimiento`
- se dejo compatibilidad con `estado` legacy para no romper frontend actual
- `GET /oportunidades` ya puede filtrar por `seguimientoEstado`
- pendiente siguiente: conectar este nuevo modelo a la captura movil y a las vistas de Gestion

### 2026-05-06
- `Gestion` paso a usar labels `Proveedores` y `Agenda` como aliases visibles
- `Resumen` ya prioriza `seguimientoEstado` en vez de depender solo de interacciones y visitas
- `Agenda` ahora mezcla calendario operativo con oportunidades `activo` y `pausado`
- se elimino lenguaje ambiguo de riesgo en la vista de `Gestion`
- se agrego `POST /oportunidades/quick-capture` para registrar interaccion + actualizar seguimiento en una sola llamada
- se agrego `Registro rapido` en `Gestion` con foco movil y recarga automatica de Resumen, Agenda e Interacciones
- `Proveedores` ahora muestra contacto principal, seguimiento, ultima interaccion, responsable y proxima accion en una sola vista
- `Historial` ahora funciona como expediente por proveedor y timeline de eventos pasados, separado de la operacion pendiente
- se hizo visible el boton `Volver` en el expediente de `Historial`
- `Biomasa` dejo de exponer `En riesgo` en seguimiento de programa y ahora usa `Detenido` como estado operativo claro
- la vista de `Biomasa` empezo a alinearse con lenguaje de `Disponibilidad`, `Negociacion` y `Programa`
- la navegacion principal de `Gestion` se simplifico a `Resumen`, `Proveedores`, `Agenda` e ingreso a `Historial`, manteniendo rutas legacy internas sin exponerlas como primer nivel
- `Biomasa > Negociacion` ahora separa negociaciones reales de perdidas reales del periodo
- las perdidas se leen desde oportunidades cerradas con motivos de negocio (`vendido_a_otro`, `sin_biomasa`, `descartado`, `no_califica`)
- Phase 4 queda funcionalmente cerrada; siguiente foco: limpieza final de textos y automatizaciones finas
- se limpiaron labels visibles de `Biomasa` para negociacion, perdidas y vistas de programa, dejando la lectura mas clara
- en `Biomasa` se empezo a separar el lenguaje visible del estado comercial interno: la UI ahora habla de `En conversacion`, `Reservada` y `Acordada`
- el selector de `Programa` ahora se alimenta solo con biomasa programable y deja de exponer el estado comercial crudo como referencia principal
- `Programa` ya trabaja por etapas: se puede finalizar, crear continuidad y reabrir de forma segura si no existe una continuidad hija
- `Finalizar programa` ya no siempre significa biomasa `Ejecutada`; ahora depende del `motivoCierre`
- la oportunidad automatica creada desde `Contacto` ahora hereda y resincroniza `empresa/proveedor`, `centroId`, `centroCodigo`, `centroComuna` y estimacion de biomasa
- los `tratos programables` ahora exponen mejor el centro vinculado para que `Programa` deje de mostrar tantos `Sin Centro Definido` cuando la relacion ya existe

### 2026-05-07
- `Gestion > Resumen` ya no enlaza a `Tratos` ni `Muestreos` como destino principal dentro de `Gestion`; ambos accesos ahora llevan a `Biomasa`
- `Biomasa` ya expone `Muestreos` como navegacion principal
- las rutas legacy `/gestion/tratos` y `/gestion/muestreos` se mantienen solo como redireccion para no romper accesos antiguos
