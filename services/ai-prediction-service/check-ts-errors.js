const { execSync } = require('child_process');

try {
  const output = execSync('tsc --noEmit', { encoding: 'utf8' });
  console.log('TypeScript compilation successful!');
  console.log(output);
} catch (error) {
  console.error('TypeScript compilation failed:');
  console.error(error.stdout);
  process.exit(1);
}
