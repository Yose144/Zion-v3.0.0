/**
 * Web mock for react-native-qrcode-svg
 */
import React from 'react';
import {View, Text} from 'react-native';

const QRCode = ({value, size = 100}) => (
  <View style={{
    width: size, height: size,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  }}>
    <Text style={{fontSize: 8, color: '#333', textAlign: 'center', fontFamily: 'monospace'}}>
      [QR: {(value || '').slice(0, 20)}...]
    </Text>
  </View>
);

export default QRCode;
