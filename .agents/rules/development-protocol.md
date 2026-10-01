# Protocolo de Desarrollo y Workflow (DBHDV)

## Reglas de Comunicacion
- Prohibido el uso de emojis en cualquier contexto o respuesta.
- Tono estrictamente tecnico, formal, sobrio y conciso.
- Evitar descripciones ostentosas. Limitarse a que se cambio, por que y como verificarlo.

## Ciclo de Trabajo Obligatorio (Workflow)
1. Plan: Definir el alcance e identificar archivos afectados.
2. Audit Plan: Validar viabilidad y detectar riesgos de regresion contra el codigo base.
3. Decompose into Phases: Dividir en fases independientes (Contratos/Tipos -> Logica/Servicios -> UI -> Validacion).
4. Audit Phases: Verificar que cada fase sea comprobable de forma aislada.
5. Build: Escribir el codigo de la fase activa de manera quirurgica.
6. Audit Build: Validar compilacion de la fase con `npx tsc --noEmit`.
7. Audit Cumulative Build Across Multiple Phases: Validar integracion completa entre modulos y empaquetado (`npm run build`).
8. Refactor: Limpieza de codigo, optimizacion y eliminacion de duplicados.
9. Audit Post-Refactor: Re-verificar compilacion limpia y ausencia de regresiones.
10. Repeat: Iterar para la siguiente fase o funcionalidad.
