# Checklist E2E Operacional

Estado: `listo para validacion manual`
Actualizado: `2026-05-07`

Usar este documento despues de la reconfiguracion actual.

## Objetivo
Validar la cadena operativa real sin ambiguedades entre:
- `Proveedor`
- `Contacto`
- `Centro`
- `Seguimiento`
- `Biomasa`
- `Programa`

## Precondiciones
- tenant seleccionado
- al menos un proveedor con centros
- al menos un contacto editable
- al menos una oportunidad o flujo de `Registro rapido`

## Flujo 1: Contacto -> Empresa -> Centro
1. Ir a `Gestion > Proveedores > Contactos`
2. Editar un contacto existente
3. Buscar empresa por nombre de proveedor
4. Buscar empresa por codigo de centro
5. Seleccionar la empresa
6. Confirmar que abajo cargan sus centros
7. Seleccionar un centro
8. Guardar

Resultado esperado:
- guarda correctamente
- al reabrir el contacto mantiene la misma empresa y centro
- el contacto sigue visible en el directorio

## Flujo 2: Sincronizacion Contacto -> Oportunidad
1. Tomar un contacto que ya tenga seguimiento activo
2. Cambiarle empresa o centro
3. Guardar

Resultado esperado:
- la oportunidad activa creada desde ese contacto se resincroniza
- se actualizan `proveedorKey` y `proveedorNombre`
- se actualizan `centroId`, `centroCodigo` y `centroComuna`
- no se crea una oportunidad activa duplicada para el mismo contacto

## Flujo 3: Registro rapido
1. Abrir `Registro rapido`
2. Buscar un proveedor del directorio
3. Registrar una gestion
4. Guardar probando:
   - `Seguir`
   - `Pausar`
   - `Cerrar`
   - `Acordar`

Resultado esperado:
- `Seguir` exige proxima accion + fecha
- `Pausar` exige motivo + fecha revision + proxima accion
- `Cerrar` exige motivo de cierre
- `Acordar` saca el caso de Gestion y alimenta Biomasa

## Flujo 4: Coherencia de Gestion
1. Ir a `Gestion > Resumen`
2. Revisar items activos y pausados
3. Ir a `Gestion > Agenda`
4. Ir a `Gestion > Proveedores`

Resultado esperado:
- los activos aparecen en agenda
- los pausados no se comportan como urgentes hasta su fecha de revision
- los cerrados no vuelven a aparecer como pendiente
- la fila del proveedor muestra correctamente ultima interaccion y proxima accion

## Flujo 5: Proveedor -> Ver centros
1. Desde `Gestion > Proveedores`
2. Hacer clic en `Ver centros` de cualquier proveedor

Resultado esperado:
- abre `Centros > Directorio`
- la lista aparece filtrada por ese proveedor
- buscador y filtros siguen funcionando
- `Limpiar` elimina el filtro del proveedor y los parametros de la URL

## Flujo 6: Consistencia del maestro de Centros
1. Editar un centro en `Centros`
2. Cambiar:
   - nombre del proveedor
   - codigo del centro
   - comuna

Resultado esperado:
- el cambio de proveedor se propaga a las colecciones relacionadas
- el cambio de codigo/comuna se propaga a los campos denormalizados dependientes
- contacto, oportunidad y programa quedan coherentes

## Flujo 7: Borrado protegido de centros
1. Intentar eliminar un centro que tenga:
   - contacto vinculado
   - oportunidad activa
   - programa activo o pausado

Resultado esperado:
- el borrado se bloquea
- el usuario ve un mensaje claro explicando el motivo

2. Intentar eliminar un centro sin relaciones activas

Resultado esperado:
- el borrado si funciona

## Flujo 8: Biomasa > Negociacion
1. Ir a `Biomasa > Status > Negociacion`
2. Confirmar estos tres bloques:
   - `Biomasa comercial pendiente`
   - `Biomasa vinculada a programa`
   - `Biomasa perdida o descartada`

Resultado esperado:
- la biomasa pendiente no aparece como programada
- la biomasa ya programada aparece en el segundo bloque
- la biomasa perdida aparece solo en el bloque de perdidas

## Flujo 9: Crear programa desde biomasa
1. Ir a `Biomasa > Programa`
2. Crear un programa desde una biomasa programable

Resultado esperado:
- proveedor correcto
- centro conservado cuando exista
- el nuevo programa aparece en la lista

## Flujo 10: Ciclo de vida de Programa
1. Pausar un programa activo
2. Reactivarlo
3. Finalizarlo usando distintos motivos:
   - `cumplido`
   - `sin_biomasa`
   - `cambio_condiciones`
   - `reemplazado_por_nuevo`

Resultado esperado:
- `cumplido` -> la biomasa queda como ejecutada
- `sin_biomasa` -> la biomasa queda como perdida
- `cambio_condiciones` y `reemplazado_por_nuevo` -> la biomasa sigue coherente para continuidad

## Flujo 11: Continuidad
1. Finalizar un programa y crear continuidad
2. Confirmar que el nuevo programa sale prellenado
3. Intentar reabrir el programa anterior
4. Intentar eliminar el programa anterior

Resultado esperado:
- el programa anterior no se puede reabrir si ya existe continuidad
- el programa anterior no se puede eliminar si ya existe continuidad
- la tabla muestra claramente la relacion entre etapas

## Flujo 12: Historial
1. Ir a `Historial`
2. Revisar la linea de tiempo de un proveedor

Resultado esperado:
- muestra solo eventos pasados
- no mezcla pendientes operativos dentro de la logica del historial

## Señales criticas de fallo
Si pasa cualquiera de estas, hay que detenerse y corregir antes de seguir:
- oportunidades activas duplicadas para un mismo contacto
- biomasa marcada como ejecutada cuando el cierre no fue `cumplido`
- continuidad que deja dos etapas activas cuando deberia existir una sola
- borrado de centro o contacto que rompe relaciones en silencio
- cambio de nombre de proveedor que deja registros mezclados con nombre viejo y nuevo
