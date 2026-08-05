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
