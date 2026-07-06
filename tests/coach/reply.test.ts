import { describe, it, expect } from 'vitest';
import { mapGroqResponse, COACH_TOOLS } from '../../lib/coach/reply';

function groqWith(message: unknown) {
  return { choices: [{ message }] };
}

describe('COACH_TOOLS', () => {
  it('define las cuatro acciones', () => {
    const names = COACH_TOOLS.map((t) => t.function.name);
    expect(names).toEqual(['log_session', 'edit_session', 'delete_session', 'adjust_plan']);
  });
});

describe('mapGroqResponse', () => {
  it('mensaje de texto normal → kind text', () => {
    const r = mapGroqResponse(groqWith({ content: 'Buen trabajo hoy.' }));
    expect(r).toEqual({ kind: 'text', content: 'Buen trabajo hoy.' });
  });

  it('tool_call válido → kind proposal con args saneados', () => {
    const r = mapGroqResponse(groqWith({
      content: 'Voy a registrarlo.',
      tool_calls: [{
        function: {
          name: 'log_session',
          arguments: JSON.stringify({ session_date: '2026-07-06', session_type: 'running_threshold', rpe: 7 }),
        },
      }],
    }));
    expect(r.kind).toBe('proposal');
    if (r.kind !== 'proposal') return;
    expect(r.proposal.action).toBe('log_session');
    expect(r.content).toBe('Voy a registrarlo.');
  });

  it('tool_call con args inválidos → degrada a texto, nunca revienta', () => {
    const r = mapGroqResponse(groqWith({
      content: null,
      tool_calls: [{ function: { name: 'log_session', arguments: '{"session_date":"ayer"}' } }],
    }));
    expect(r.kind).toBe('text');
    expect(r.content.length).toBeGreaterThan(0);
  });

  it('arguments con JSON roto → degrada a texto', () => {
    const r = mapGroqResponse(groqWith({
      tool_calls: [{ function: { name: 'log_session', arguments: '{oops' } }],
    }));
    expect(r.kind).toBe('text');
  });

  it('respuesta sin choices → texto de error controlado', () => {
    expect(mapGroqResponse({}).kind).toBe('text');
    expect(mapGroqResponse(null).kind).toBe('text');
  });
});
