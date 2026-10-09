/**
 * NotificationsWhatsappScreen
 *
 * Gestión de los números de WhatsApp de la empresa, en dos pestañas:
 *
 * - **Notificaciones**: sesión del número saliente para reparto, documentos de
 *   empleados, exports y campañas. Permiso `notifications.whatsapp.session.manage`.
 *   API: `/notifications/whatsapp/{status,qr,start,logout}`.
 * - **Consultas**: número interno donde el personal autorizado consulta ventas
 *   por WhatsApp. Permisos `consultas_wa.sesion.gestionar` (sesión) y
 *   `consultas_wa.contactos.gestionar` (números autorizados). API: `/consultas-wa`.
 *
 * Ambos son independientes del chatbot de ventas. La pantalla abre con
 * cualquiera de los tres permisos y sólo muestra las pestañas permitidas.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Label } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { GradientHeader, contentWidthStyle } from '@/design-system/components';
import { ConsultasWaTab, NotificationsWaTab } from '@/components/NotificationsWhatsapp';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

type WaTab = 'notificaciones' | 'consultas';

const TAB_META: Record<
  WaTab,
  {
    label: string;
    icon: 'notifications-outline' | 'chatbubbles-outline';
    title: string;
    subtitle: string;
  }
> = {
  notificaciones: {
    label: 'Notificaciones',
    icon: 'notifications-outline',
    title: 'WhatsApp de Notificaciones',
    subtitle: 'Sesión del número saliente para reparto, documentos, exports y campañas.',
  },
  consultas: {
    label: 'Consultas',
    icon: 'chatbubbles-outline',
    title: 'Número de consultas',
    subtitle: 'El personal autorizado consulta ventas por WhatsApp y recibe respuestas.',
  },
};

export const NotificationsWhatsappScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { hasPermission, loading } = usePermissions();

  const canNotifications = hasPermission(PERMISSIONS.NOTIFICATIONS.WHATSAPP.SESSION_MANAGE);
  const canConsultasSession = hasPermission(PERMISSIONS.CONSULTAS_WA.SESION_GESTIONAR);
  const canConsultasContacts = hasPermission(PERMISSIONS.CONSULTAS_WA.CONTACTOS_GESTIONAR);
  const canConsultas = canConsultasSession || canConsultasContacts;

  const tabs: WaTab[] = [
    ...(canNotifications ? (['notificaciones'] as const) : []),
    ...(canConsultas ? (['consultas'] as const) : []),
  ];

  const [tab, setTab] = useState<WaTab>('notificaciones');
  const activeTab: WaTab | undefined = tabs.includes(tab) ? tab : tabs[0];

  useEffect(() => {
    if (activeTab && activeTab !== tab) setTab(activeTab);
  }, [activeTab, tab]);

  const meta = TAB_META[activeTab ?? 'notificaciones'];

  return (
    <View style={styles.root}>
      <GradientHeader icon="logo-whatsapp" title={meta.title} subtitle={meta.subtitle} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + spacing[6] },
          contentWidthStyle,
        ]}
      >
        {tabs.length > 1 ? (
          <View style={styles.segmented}>
            {tabs.map((t) => {
              const selected = t === activeTab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={TAB_META[t].icon}
                    size={16}
                    color={selected ? theme.color.text.onAction : theme.color.text.muted}
                  />
                  <Label color={selected ? theme.color.text.onAction : theme.color.text.muted}>
                    {TAB_META[t].label}
                  </Label>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!activeTab ? (
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.color.text.muted} />
            </View>
          ) : (
            <Body color={theme.color.text.muted} style={styles.centerText}>
              No tienes permisos para gestionar los números de WhatsApp.
            </Body>
          )
        ) : activeTab === 'notificaciones' ? (
          <NotificationsWaTab />
        ) : (
          <ConsultasWaTab
            canManageSession={canConsultasSession}
            canManageContacts={canConsultasContacts}
          />
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    flex: {
      flex: 1,
    },
    container: {
      padding: spacing[4],
      gap: spacing[4],
    },
    segmented: {
      flexDirection: 'row',
      gap: spacing[1],
      padding: spacing[1],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.surface.muted,
      alignSelf: 'flex-start',
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[4],
      borderRadius: borderRadius.md,
    },
    segmentSelected: {
      backgroundColor: theme.color.action.primary.background,
    },
    center: {
      alignItems: 'center',
      padding: spacing[6],
    },
    centerText: {
      textAlign: 'center',
      padding: spacing[6],
    },
  });

export default NotificationsWhatsappScreen;
