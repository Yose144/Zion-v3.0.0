/**
 * Web mock for react-native-vector-icons/MaterialCommunityIcons
 * Renders text fallback with the icon name on web
 */
import React from 'react';
import {Text} from 'react-native';

const Icon = ({name, size = 24, color = '#fff', style}) => (
  <Text style={[{fontSize: size, color, fontFamily: 'monospace', textAlign: 'center', width: size, height: size, lineHeight: size}, style]}>
    ⬡
  </Text>
);

Icon.displayName = 'MockIcon';
export default Icon;
