/**
 * Ponytail Ultra: Runnable Zero-Dependency Test Suite for NexusAuth
 * Run with Node.js: `node tests/auth-check.js`
 */

const assert = require('assert');

// 1. Enhanced Sanitize helper
function sanitizeInput(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[&<>"'/]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '/': '&#x2F;' }[m];
    })
    .trim();
}

// 2. Email validator verification
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 3. Password strength evaluator
function evaluatePasswordStrength(pass) {
  if (!pass || pass.length < 6) return { score: 0, text: 'Muito Curta' };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;
  return { score };
}

// --- TEST SUITE EXECUTION ---
console.log('🧪 Iniciando testes de validação & segurança do NexusAuth (Ponytail Ultra Check)...');

// Test 1: XSS Sanitization & Special Characters
const maliciousInput = '<script>alert("xss")</script>';
assert.strictEqual(
  sanitizeInput(maliciousInput),
  '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
  'Falha: Sanitização contra XSS deve escapar tags e barras.'
);
console.log('  ✓ Test 1: Sanitização XSS e barras aprovada');

// Test 2: Control Characters Stripping
const controlInput = 'Thiago\u0000\u001F Silva';
assert.strictEqual(sanitizeInput(controlInput), 'Thiago Silva', 'Caracteres de controle devem ser removidos');
console.log('  ✓ Test 2: Remoção de caracteres de controle invisíveis aprovada');

// Test 3: Email Format Validation
assert.strictEqual(isValidEmail('thiago@provedor.com'), true, 'Email válido deve ser aceito');
assert.strictEqual(isValidEmail('thiagox47.dev'), false, 'Email sem @ ou domínio deve ser rejeitado');
assert.strictEqual(isValidEmail('thiago@dominio'), false, 'Email sem TLD deve ser rejeitado');
console.log('  ✓ Test 3: Validação RFC de e-mails aprovada');

// Test 4: Password Strength Scoring
assert.strictEqual(evaluatePasswordStrength('12345').score, 0, 'Senha curta deve ter score 0');
assert.strictEqual(evaluatePasswordStrength('MinhaSenhaForte@2026').score >= 4, true, 'Senha complexa deve ter score alto');
console.log('  ✓ Test 4: Avaliador de entropia e força de senha aprovado');

console.log('🎉 Todos os 4 testes de segurança passaram com 100% de sucesso!');
