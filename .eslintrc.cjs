module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    {
      // react-three-fiber renders three.js objects as JSX intrinsics
      // (mesh, position, args, castShadow, ...) — eslint-plugin-react
      // doesn't know about them, so this rule fires false positives here.
      files: ['src/components/CabinetView3D.jsx', 'src/components/EquipmentBox.jsx', 'src/components/ShelfMesh.jsx', 'src/components/PhysicalCable.jsx'],
      rules: {
        'react/no-unknown-property': 'off',
      },
    },
  ],
};
