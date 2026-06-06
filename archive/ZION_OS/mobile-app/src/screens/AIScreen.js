/**
 * ZION AI Screen v3.0.0
 *
 * Chat interface for Hiran v2.2 (local LLM inference — port 8002) and
 * quick-access panel for the Neural Compute Layer via Hiranyagarbha (port 8001).
 */

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GlassCard from '../components/common/GlassCard';
import {colors, spacing, typography, borderRadius} from '../constants/theme';
import {CONFIG} from '../constants/config';
import AIService from '../services/AIService';

const StatusDot = ({online, label}) => (
  <View style={styles.statusDot}>
    <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
    <Text style={styles.statusLabel}>{label}</Text>
    <Text style={[styles.statusValue, {color: online ? colors.status.success : colors.status.error}]}>
      {online ? 'Online' : 'Offline'}
    </Text>
  </View>
);

const MessageBubble = ({message}) => {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
      {!isUser && (
        <View style={styles.bubbleHeader}>
          <Icon name="brain" size={14} color={colors.primary.purple} />
          <Text style={styles.bubbleSender}>Hiran</Text>
        </View>
      )}
      <Text style={styles.bubbleText}>{message.content}</Text>
    </View>
  );
};

const AIScreen = () => {
  const scrollRef = useRef(null);
  const [hiranOnline, setHiranOnline] = useState(false);
  const [hiranyaOnline, setHiranyaOnline] = useState(false);
  const [messages, setMessages] = useState([
    {id: '0', role: 'assistant', content: 'Hello! I am Hiran, your ZION AI assistant. Ask me anything about blockchain, mining, or NCL.'},
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [nclWorkerCount, setNclWorkerCount] = useState(0);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages]);

  const checkHealth = useCallback(async () => {
    try {
      const [hiran, hiranya] = await Promise.all([
        AIService.checkHiranHealth(),
        AIService.checkHiranyagarbhaHealth(),
      ]);
      setHiranOnline(hiran.ok);
      setHiranyaOnline(hiranya.ok);

      if (hiranya.ok) {
        const workers = await AIService.getNCLWorkers();
        if (workers) {
          setNclWorkerCount(Array.isArray(workers) ? workers.length : (workers.count || 0));
        }
      }
    } catch (e) {
      console.error('Health check:', e);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    if (!hiranOnline) {
      setMessages(prev => [...prev, {id: Date.now().toString(), role: 'system', content: 'Hiran is offline. Start inference server first.'}]);
      return;
    }

    setMessages(prev => [...prev, {id: Date.now().toString(), role: 'user', content: text}]);
    setInputText('');
    setSending(true);

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content}));

    try {
      const reply = await AIService.askHiran(text, 0.7, history);
      setMessages(prev => [...prev, {id: (Date.now() + 1).toString(), role: 'assistant', content: reply}]);
    } catch (error) {
      setMessages(prev => [...prev, {id: (Date.now() + 1).toString(), role: 'system', content: `Error: ${error.message}`}]);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, hiranOnline, messages]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>

      {/* Status bar */}
      <GlassCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <StatusDot online={hiranOnline} label="Hiran v2.2" />
          <StatusDot online={hiranyaOnline} label="Orchestrator" />
          <View style={styles.nclBadge}>
            <Icon name="chip" size={14} color={colors.primary.cyan} />
            <Text style={styles.nclBadgeText}>NCL: {nclWorkerCount} workers</Text>
          </View>
        </View>
      </GlassCard>

      {/* Chat */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}>
        {messages.map(msg => (
          msg.role === 'system'
            ? <View key={msg.id} style={styles.systemMsg}><Text style={styles.systemMsgText}>{msg.content}</Text></View>
            : <MessageBubble key={msg.id} message={msg} />
        ))}
        {sending && (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={colors.primary.purple} />
            <Text style={styles.thinkingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <GlassCard style={styles.inputCard}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={hiranOnline ? 'Ask Hiran anything...' : 'Hiran offline'}
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || !inputText.trim()}
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}>
            <Icon name="send" size={20} color={inputText.trim() && !sending ? colors.primary.gold : colors.text.muted} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'transparent'},

  statusCard: {margin: spacing.md, marginBottom: spacing.sm},
  statusRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm},
  statusDot: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  dot: {width: 8, height: 8, borderRadius: 4},
  dotOnline: {backgroundColor: colors.status.success},
  dotOffline: {backgroundColor: colors.status.error},
  statusLabel: {...typography.caption, color: colors.text.secondary},
  statusValue: {...typography.caption, fontWeight: '600'},
  nclBadge: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  nclBadgeText: {...typography.caption, color: colors.primary.cyan},

  chatArea: {flex: 1},
  chatContent: {paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm},

  bubble: {maxWidth: '82%', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: 2},
  bubbleUser: {alignSelf: 'flex-end', backgroundColor: 'rgba(147,51,234,0.2)', borderWidth: 1, borderColor: 'rgba(147,51,234,0.35)'},
  bubbleAI: {alignSelf: 'flex-start', backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)'},
  bubbleHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs},
  bubbleSender: {...typography.caption, color: colors.primary.purple, fontSize: 11},
  bubbleText: {...typography.body, color: colors.text.primary, lineHeight: 22},

  systemMsg: {alignSelf: 'center', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: borderRadius.sm, padding: spacing.sm, maxWidth: '90%'},
  systemMsgText: {...typography.caption, color: colors.status.warning, textAlign: 'center'},

  thinking: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, alignSelf: 'flex-start'},
  thinkingText: {...typography.caption, color: colors.primary.purple, fontStyle: 'italic'},

  inputCard: {margin: spacing.md, marginTop: spacing.sm},
  inputRow: {flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm},
  textInput: {
    flex: 1, ...typography.body, color: colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.glass.border,
    borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: {backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)'},
});

export default AIScreen;
