import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function getTrackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const trackedFiles = getTrackedFiles();
const failures = [];

const forbiddenEnvFile = /(^|\/)\.env($|\.)/;
const allowedEnvFile = /(^|\/)\.env\.example$/;
const secretPatterns = [
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', pattern: /-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----/ },
  { name: 'JWT token literal', pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  {
    name: 'sensitive env assignment',
    pattern: /(?:^|\n)\s*(?:JWT_SECRET|JWT_REFRESH_SECRET|MONGO_URI|MONGODB_URI|RESEND_API_KEY|SUPABASE_SERVICE_ROLE_KEY|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID)\s*=\s*(?!$|<|replace-with|test-|mongodb:\/\/localhost|mongodb:\/\/127\.0\.0\.1)[^\s#]+/i,
  },
];

for (const file of trackedFiles) {
  const normalized = file.replace(/\\/g, '/');
  if (forbiddenEnvFile.test(normalized) && !allowedEnvFile.test(normalized)) {
    failures.push(`${file}: archivo de entorno no debe estar versionado`);
    continue;
  }

  if (/\.(png|jpg|jpeg|webp|gif|pdf|ico|woff2?)$/i.test(file)) continue;

  let content = '';
  try {
    content = readFileSync(path.join(root, file), 'utf8');
  } catch {
    continue;
  }

  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) {
      failures.push(`${file}: posible secreto detectado (${rule.name})`);
    }
  }
}

if (failures.length > 0) {
  console.error('Fallo de seguridad: archivos sensibles detectados.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`OK: ${trackedFiles.length} archivos versionados revisados sin secretos obvios.`);
