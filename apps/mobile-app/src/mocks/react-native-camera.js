/**
 * Web mock for react-native-camera
 */
import React from 'react';
import {View, Text} from 'react-native';

export const RNCamera = (props) => (
  <View style={[{backgroundColor: '#000', padding: 20, alignItems: 'center'}, props.style]}>
    <Text style={{color: '#fff'}}>📷 Camera not available on Web</Text>
  </View>
);

RNCamera.Constants = {
  Type: {back: 'back', front: 'front'},
  FlashMode: {on: 'on', off: 'off', auto: 'auto'},
  BarCodeType: {qr: 'qr'},
};

export default {RNCamera};
