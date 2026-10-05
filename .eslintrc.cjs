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
  ignorePatterns: ['dist', 'node_modules', 'public/draco'],
  overrides: [
    {
      // react-three-fiber renders three.js objects as JSX intrinsics
      // (mesh, position, args, castShadow, ...) — eslint-plugin-react
      // doesn't know about them, so this rule fires false positives here.
      files: ['src/components/RoomWiring3D.jsx', 'src/components/RoomView3D.jsx', 'src/components/CabinetView3D.jsx', 'src/components/EquipmentBox.jsx', 'src/components/ShelfMesh.jsx', 'src/components/PhysicalCable.jsx', 'src/components/ShelfValidator.jsx', 'src/components/MaterialPicker.jsx', 'src/components/RackFrame.jsx', 'src/components/EquipmentModel.jsx', 'src/components/RoutedCables.jsx'],
      rules: {
        'react/no-unknown-property': 'off',
        'react/jsx-no-undef': 'off', // Suspense, useRef и r3f JSX intrinsics — false positives в r3f проектах
      },
    },
  ],
};
