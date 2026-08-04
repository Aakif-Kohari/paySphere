const fs = require('fs');
const path = require('path');

const write = (fPath, content) => {
  fs.mkdirSync(path.dirname(fPath), { recursive: true });
  fs.writeFileSync(fPath, content.trim() + '\n');
};

// 1. Root package.json (Workspaces configuration)
write(path.join(__dirname, 'package.json'), `
{
  "name": "paysphere-monorepo",
  "private": true,
  "workspaces": [
    "frontend",
    "backend",
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
`);

// 2. turbo.json
write(path.join(__dirname, 'turbo.json'), `
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
`);

// 3. packages/shared/package.json
write(path.join(__dirname, 'packages', 'shared', 'package.json'), `
{
  "name": "@paysphere/shared",
  "version": "1.0.0",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "lint": "eslint ."
  }
}
`);

// 4. packages/shared/index.js (stub for shared utilities)
write(path.join(__dirname, 'packages', 'shared', 'index.js'), `
// Shared business logic and utilities for web and mobile
module.exports = {
  formatCurrency: (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  }
};
`);

// 5. apps/mobile/package.json (Expo stub)
write(path.join(__dirname, 'apps', 'mobile', 'package.json'), `
{
  "name": "paysphere-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~50.0.14",
    "react": "18.2.0",
    "react-native": "0.73.6",
    "@paysphere/shared": "*"
  }
}
`);

// 6. apps/mobile/App.js
write(path.join(__dirname, 'apps', 'mobile', 'App.js'), `
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@paysphere/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>PaySphere Mobile App (React Native)</Text>
      <Text>Sample Shared Util: {formatCurrency(150000)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
`);

console.log('Monorepo workspace and React Native skeleton created successfully.');
