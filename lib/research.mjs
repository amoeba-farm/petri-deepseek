import { createHash } from 'node:crypto';

export function agentName(session) {
  return `dsh-${createHash('sha256').update(String(session || 'petri-panel')).digest('hex').slice(0,24)}`;
}

export function researchArgs(config, agent) {
  return ['--agent', agent, '--harness', 'DeepSeek Harness',
    ...(config.workspaceUrl ? ['--url', config.workspaceUrl] : []),
    ...(config.profileDirectory ? ['--profile-dir', config.profileDirectory] : [])];
}

// A workspace's full list runs past 100 KB, more than the Harness keeps of one
// tool result; the list keeps what choosing an assignment needs.
function compactWorkList(data) {
  if (!Array.isArray(data?.work)) return data;
  const pick = (object, keys) => object && Object.fromEntries(keys.filter(key => object[key] != null).map(key => [key, object[key]]));
  return { ...data, work: data.work.map(item => ({
    ...pick(item, ['id', 'title', 'brief', 'focused', 'guidance', 'candidateScope', 'archivedAt']),
    objective: pick(item.objective, ['kind', 'phase', 'status', 'url', 'sourceAddress', 'expiryId', 'bucketLabel', 'bucketName']),
  })) };
}

const str = description => ({ type: 'string', description });
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
export const RESEARCH = [
  { name: 'petri_login', description: 'Connect this DeepSeek session to Petri. Show its pairing code; complete login after approval in Petri Connect. Credentials stay private.', schema: schema(), args: () => ['agent', 'login'] },
  { name: 'petri_work_list', description: 'Read Petri research assignments and current guidance, each shortened to its brief and scope; petri_work_start or petri_work_next returns an assignment in full.', schema: schema(), args: () => ['work', 'list'], compact: compactWorkList },
  { name: 'petri_work_next', description: 'Start or resume the next Petri research run. Follow nextStep and report progress. After finishing, call again until status is idle or the user stops the work.', schema: schema(), args: () => ['work', 'next'] },
  { name: 'petri_work_start', description: 'Start a specified research assignment. Reuse clientKey when retrying a lost response.', schema: schema({ workId: str('Assignment id'), clientKey: str('Stable request key') }, ['workId','clientKey']), args: a => ['work','start',a.workId,'--key',a.clientKey] },
  { name: 'petri_report_progress', description: 'Report a research step for the Petri activity feed. A report is not a verified oracle result. Reuse clientKey when retrying.', schema: schema({ runId: str('Run id'), kind: { type:'string',enum:['search','read','value','submit','note','source_found','blocked'] }, message: str('Brief progress report'), referenceUrl: str('HTTPS page read'), clientKey: str('Stable request key') }, ['runId','kind','message','clientKey']), args: a => ['work','report',a.runId,'--kind',a.kind,'--message',a.message,'--key',a.clientKey,...(a.referenceUrl?['--source',a.referenceUrl]:[])] },
  { name: 'petri_submit_candidate', description: 'Submit a candidate JSON file through Petri under this session’s research identity. Include evidenceBundle for authenticated web evidence. A submission is not oracle acceptance or payment.', schema: schema({ runId: str('Run id'), file: str('Candidate JSON file path'), evidenceBundle: str('Optional evidence bundle path'), clientKey: str('Stable request key') }, ['runId','file','clientKey']), args: a => ['work','submit',a.runId,'--file',a.file,'--key',a.clientKey,...(a.evidenceBundle?['--evidence-bundle',a.evidenceBundle]:[])] },
  { name: 'petri_run_finish', description: 'Finish a research run, then call petri_work_next to continue.', schema: schema({ runId: str('Run id'), summary: str('Research summary') }, ['runId','summary']), args: a => ['work','finish',a.runId,'--summary',a.summary] },
  { name: 'petri_activity', description: 'Read this agent’s activity, submissions, and observed backend outcomes.', schema: schema(), args: () => ['activity'] },
  { name: 'petri_rewards', description: 'Read recorded source outcomes and payouts. Pending candidates are not confirmed rewards.', schema: schema(), args: () => ['rewards'] },
  { name: 'petri_session_open', description: 'Open a Petri research session with the same agent identity.', schema: schema(), args: () => ['session','open'] },
  { name: 'petri_session_close', description: 'Close this agent’s Petri research session.', schema: schema(), args: () => ['session','close'] },
];

// Raw Cordis JSON-Schema tools own validation. Reject unknown and malformed
// fields here as well as keeping the schema visible to the model.
export function validateInput(definition, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object.');
  const spec = definition.schema;
  for (const key of Object.keys(input)) if (!Object.hasOwn(spec.properties, key)) throw new Error(`Unknown field: ${key}`);
  for (const key of spec.required) if (!Object.hasOwn(input, key)) throw new Error(`Missing field: ${key}`);
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`Invalid ${key}.`);
    if (spec.properties[key].enum && !spec.properties[key].enum.includes(value)) throw new Error(`Invalid ${key}.`);
    // These go to Petri as positional arguments; a leading '-' would read as a flag.
    if (POSITIONAL.has(key) && value.trim().startsWith('-')) throw new Error(`Invalid ${key}.`);
  }
  return input;
}
const POSITIONAL = new Set(['workId', 'runId']);
