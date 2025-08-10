#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  warnings: []
};

/**
 * Log a success message
 */
function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
  results.passed.push(message);
}

/**
 * Log an error message
 */
function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
  results.failed.push(message);
}

/**
 * Log a warning message
 */
function logWarning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
  results.warnings.push(message);
}

/**
 * Log a section header
 */
function logSection(title) {
  console.log(`\n${colors.cyan}══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}══════════════════════════════════════${colors.reset}\n`);
}

/**
 * Check if a directory exists
 */
function checkDirectory(dirPath, name) {
  if (fs.existsSync(dirPath)) {
    logSuccess(`${name} directory exists`);
    return true;
  } else {
    logError(`${name} directory not found: ${dirPath}`);
    return false;
  }
}

/**
 * Check if a file exists
 */
function checkFile(filePath, name) {
  if (fs.existsSync(filePath)) {
    logSuccess(`${name} file exists`);
    return true;
  } else {
    logError(`${name} file not found: ${filePath}`);
    return false;
  }
}

/**
 * Check Node.js version
 */
async function checkNodeVersion() {
  try {
    const { stdout } = await execPromise('node --version');
    const version = stdout.trim();
    const major = parseInt(version.split('.')[0].substring(1));
    
    if (major >= 18) {
      logSuccess(`Node.js version ${version} meets requirements (>=18.0.0)`);
    } else {
      logError(`Node.js version ${version} is too old (requires >=18.0.0)`);
    }
  } catch (error) {
    logError(`Failed to check Node.js version: ${error.message}`);
  }
}

/**
 * Check npm version
 */
async function checkNpmVersion() {
  try {
    const { stdout } = await execPromise('npm --version');
    const version = stdout.trim();
    const major = parseInt(version.split('.')[0]);
    
    if (major >= 9) {
      logSuccess(`npm version ${version} meets requirements (>=9.0.0)`);
    } else {
      logWarning(`npm version ${version} is older than recommended (>=9.0.0)`);
    }
  } catch (error) {
    logError(`Failed to check npm version: ${error.message}`);
  }
}

/**
 * Check if PostgreSQL is running
 */
async function checkPostgreSQL() {
  try {
    const { stdout } = await execPromise('pg_isready');
    if (stdout.includes('accepting connections')) {
      logSuccess('PostgreSQL is running and accepting connections');
    } else {
      logWarning('PostgreSQL is not accepting connections');
    }
  } catch (error) {
    logWarning('PostgreSQL check failed - ensure PostgreSQL is installed and running');
  }
}

/**
 * Check if a service can be built
 */
async function checkServiceBuild(servicePath, serviceName) {
  const fullPath = path.join(__dirname, '..', servicePath);
  
  if (!fs.existsSync(fullPath)) {
    logError(`${serviceName} service directory not found`);
    return false;
  }
  
  const packageJsonPath = path.join(fullPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    logError(`${serviceName} package.json not found`);
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    logSuccess(`${serviceName} package.json is valid`);
    
    // Check for required dependencies
    const requiredDeps = {
      'ai-prediction-service': ['@tensorflow/tfjs-node', 'express'],
      'zoho-integration': ['@zohocrm/nodejs-sdk-2.1', 'express'],
      'sales-frontend': ['react', 'react-dom', '@mui/material'],
      'data-import': ['csv-parser', 'pg']
    };
    
    const serviceKey = servicePath.split('/').pop();
    const deps = requiredDeps[serviceKey] || [];
    
    for (const dep of deps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        logSuccess(`  - ${dep} dependency found`);
      } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        logSuccess(`  - ${dep} devDependency found`);
      } else {
        logWarning(`  - ${dep} dependency missing`);
      }
    }
    
    return true;
  } catch (error) {
    logError(`${serviceName} package.json is invalid: ${error.message}`);
    return false;
  }
}

/**
 * Check TypeScript configuration
 */
async function checkTypeScriptConfig(servicePath, serviceName) {
  const fullPath = path.join(__dirname, '..', servicePath);
  const tsconfigPath = path.join(fullPath, 'tsconfig.json');
  
  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      logSuccess(`${serviceName} TypeScript config is valid`);
      return true;
    } catch (error) {
      logError(`${serviceName} TypeScript config is invalid: ${error.message}`);
      return false;
    }
  } else {
    logWarning(`${serviceName} TypeScript config not found`);
    return false;
  }
}

/**
 * Check CSV data file
 */
function checkDataFile() {
  const csvPath = 'C:\\code\\Dynamo\\dynamo_data\\database\\microservice_migration\\docs\\user_journey\\Invoices_Mangalam .csv';
  
  if (fs.existsSync(csvPath)) {
    const stats = fs.statSync(csvPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    logSuccess(`Invoice CSV file found (${sizeMB} MB)`);
    
    // Check if we can read the first line
    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n');
      const headers = lines[0].split(',');
      logSuccess(`  - CSV has ${headers.length} columns`);
      logSuccess(`  - CSV has ${lines.length} rows`);
    } catch (error) {
      logWarning(`  - Could not read CSV file: ${error.message}`);
    }
  } else {
    logWarning('Invoice CSV file not found - data import will not work');
  }
}

/**
 * Main validation function
 */
async function validateSetup() {
  console.log(`\n${colors.blue}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║         Mangalm Sales Assistant Validation          ║${colors.reset}`);
  console.log(`${colors.blue}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  // Check environment
  logSection('Environment Checks');
  await checkNodeVersion();
  await checkNpmVersion();
  await checkPostgreSQL();
  
  // Check directory structure
  logSection('Directory Structure');
  checkDirectory(path.join(__dirname, '..', 'database'), 'Database');
  checkDirectory(path.join(__dirname, '..', 'services'), 'Services');
  checkDirectory(path.join(__dirname, '..', 'services', 'ai-prediction-service'), 'AI Prediction Service');
  checkDirectory(path.join(__dirname, '..', 'services', 'zoho-integration'), 'Zoho Integration');
  checkDirectory(path.join(__dirname, '..', 'services', 'sales-frontend'), 'Sales Frontend');
  checkDirectory(path.join(__dirname, '..', 'services', 'data-import'), 'Data Import');
  
  // Check service configurations
  logSection('Service Configurations');
  await checkServiceBuild('services/ai-prediction-service', 'AI Prediction');
  await checkServiceBuild('services/zoho-integration', 'Zoho Integration');
  await checkServiceBuild('services/sales-frontend', 'Sales Frontend');
  await checkServiceBuild('services/data-import', 'Data Import');
  
  // Check TypeScript configurations
  logSection('TypeScript Configurations');
  await checkTypeScriptConfig('services/ai-prediction-service', 'AI Prediction');
  await checkTypeScriptConfig('services/zoho-integration', 'Zoho Integration');
  await checkTypeScriptConfig('services/sales-frontend', 'Sales Frontend');
  await checkTypeScriptConfig('database', 'Database');
  
  // Check critical files
  logSection('Critical Files');
  checkFile(path.join(__dirname, '..', 'package.json'), 'Root package.json');
  checkFile(path.join(__dirname, '..', 'docker-compose.yml'), 'Docker Compose');
  checkFile(path.join(__dirname, '..', '.env.example'), 'Environment template');
  
  // Check data files
  logSection('Data Files');
  checkDataFile();
  
  // Summary
  logSection('Validation Summary');
  console.log(`${colors.green}Passed: ${results.passed.length}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${results.warnings.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed.length}${colors.reset}`);
  
  if (results.failed.length === 0) {
    console.log(`\n${colors.green}✅ Mangalm Sales Assistant is ready for deployment!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}❌ Validation failed. Please fix the issues above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run validation
validateSetup().catch(error => {
  console.error(`${colors.red}Validation script error: ${error.message}${colors.reset}`);
  process.exit(1);
});