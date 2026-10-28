import { RESEARCH } from './lib/research.mjs';
import { MARKET } from './lib/market.mjs';
import { BOT_TOOLS } from './lib/bots.mjs';
import { ORACLE } from './lib/oracle.mjs';

export const inject = ['petri', 'tools'];
// The model reads the JSON; the chat's Petri cards parse the same text.
const output = { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };

export function apply(ctx) {
  for (const definition of MARKET) {
    ctx.tools.register({
      name: definition.name, description: definition.description,
      parameters: definition.schema, output,
      execute(input, exec) {
        return ctx.petri.invoke({ action: 'market', tool: definition.name, input: input || {} }, exec.signal);
      },
    });
  }
  for (const definition of ORACLE) {
    ctx.tools.register({
      name: definition.name, description: definition.description,
      parameters: definition.schema, output,
      execute(input, exec) {
        return ctx.petri.invoke({ action: 'oracle', tool: definition.name, input: input || {} }, exec.signal);
      },
    });
  }
  for (const definition of BOT_TOOLS) {
    ctx.tools.register({
      name: definition.name, description: definition.description,
      parameters: definition.schema, output,
      execute(input, exec) {
        return ctx.petri.invoke({ action: 'bots', op: definition.op, input: input || {} }, exec.signal);
      },
    });
  }
  ctx.tools.register({
    name: 'petri_command',
    description: 'Run any public Petri command using argument strings, without a shell: oracle, evidence, funding, claims and everything the structured petri_* tools do not cover. Use --help to discover grammar. Writes require the user’s authorization; add --yes only for an already authorized operation. Never retry a submitted transaction blindly. Provider and wallet secrets stay local.',
    parameters: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } }, required: ['args'], additionalProperties: false },
    output,
    async execute(args, exec) {
      if (!args || Object.keys(args).some(key => key !== 'args')) throw new Error('Expected Petri args.');
      return ctx.petri.invoke({ action: 'command', args: args.args }, exec.signal);
    },
  });
  for (const definition of RESEARCH) {
    ctx.tools.register({
      name: definition.name, description: definition.description,
      parameters: definition.schema, output,
      execute(input, exec) {
        return ctx.petri.invoke({ action: 'research', tool: definition.name, input, sessionId: exec.agent.id }, exec.signal);
      },
    });
  }
}
