import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DocumentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Company Documents</Text>
        <Text style={styles.subtitle}>Access policies, guidelines, and organization files</Text>

        <View style={styles.cardList}>
          {['Employee Handbook 2026', 'HR Leave Policy', 'Travel & Expense Guidelines'].map((doc, idx) => (
            <View key={idx} style={styles.card}>
              <Ionicons name="document-text-outline" size={24} color="#0041E8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{doc}</Text>
                <Text style={styles.docSub}>PDF • 2.4 MB</Text>
              </View>
              <Ionicons name="cloud-download-outline" size={22} color="#64748B" />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  cardList: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  docName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  docSub: { fontSize: 13, color: '#64748B' },
});
