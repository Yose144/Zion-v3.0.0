import React from 'react';
import {View, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {colors, borderRadius, shadows} from '../../constants/theme';

/**
 * Glass Card Component — Unified with desktop-agent & website (rasta palette)
 * Matches:
 *   - desktop: --card-bg rgba(13,13,13,0.82), --glass-border rgba(255,255,255,0.12)
 *   - website: bg-black/50, border-white/10, backdrop-blur-xl
 */
const GlassCard = ({children, style, onPress, gradient = false, glow = false}) => {
  const CardWrapper = onPress ? TouchableOpacity : View;

  const webBlur = Platform.OS === 'web' ? {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } : {};

  const glowStyle = glow ? {
    borderColor: colors.primary.gold,
    ...Platform.select({
      web: { boxShadow: `0 0 16px ${colors.glow.gold}` },
      default: shadows.glow,
    }),
  } : {};

  return (
    <CardWrapper
      style={[styles.container, webBlur, glowStyle, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}>
      {gradient ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          style={styles.inner}>
          {children}
        </LinearGradient>
      ) : (
        <View style={styles.inner}>{children}</View>
      )}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    ...shadows.md,
  },
  inner: {
    padding: 20,
  },
});

export default GlassCard;
