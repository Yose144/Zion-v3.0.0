import React from 'react';
import {TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {colors, gradients, borderRadius, typography, shadows} from '../../constants/theme';

/**
 * Gradient Button — Unified with desktop-agent & website (rasta palette)
 * Matches desktop .btn-primary with gradient + glow
 * Variants: gold, red, green, rasta (tri-color)
 */
const GradientButton = ({
  title,
  onPress,
  variant = 'gold', // gold, red, green, rasta
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const gradientColors = gradients[variant] || gradients.gold;
  const opacity = disabled || loading ? 0.5 : 1;

  const glowMap = {
    gold: colors.glow.gold,
    red: colors.glow.red,
    green: colors.glow.green,
    rasta: colors.glow.gold,
  };
  const webGlow = Platform.OS === 'web' ? {
    boxShadow: `0 0 30px ${glowMap[variant] || glowMap.gold}`,
  } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.container, webGlow, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[styles.gradient, {opacity}]}>
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.text, textStyle]}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  text: {
    ...typography.h3,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default GradientButton;
