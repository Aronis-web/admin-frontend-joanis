import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';

interface WidgetData {
  ventasTotal: number;
  comprasTotal: number;
  fecha: string;
}

export function DashboardWidget({ data }: { data?: WidgetData }) {
  const ventasTotal = data?.ventasTotal || 0;
  const comprasTotal = data?.comprasTotal || 0;
  const fecha = data?.fecha || 'Ayer';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          height: 'wrap_content',
          width: 'match_parent',
          marginBottom: 12,
        }}
      >
        <TextWidget
          text="📊 Dashboard"
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: '#1E293B',
            marginBottom: 4,
          }}
        />
        <TextWidget
          text={fecha}
          style={{
            fontSize: 12,
            color: '#64748B',
          }}
        />
      </FlexWidget>

      {/* Ventas Card */}
      <FlexWidget
        style={{
          height: 'wrap_content',
          width: 'match_parent',
          backgroundColor: '#F0FDF4',
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="💰 Ventas"
          style={{
            fontSize: 12,
            color: '#64748B',
            marginBottom: 4,
          }}
        />
        <TextWidget
          text={`S/ ${ventasTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: '#1E293B',
          }}
        />
      </FlexWidget>

      {/* Compras Card */}
      <FlexWidget
        style={{
          height: 'wrap_content',
          width: 'match_parent',
          backgroundColor: '#EEF2FF',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <TextWidget
          text="🛒 Compras"
          style={{
            fontSize: 12,
            color: '#64748B',
            marginBottom: 4,
          }}
        />
        <TextWidget
          text={`S/ ${comprasTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          style={{
            fontSize: 20,
            fontWeight: 'bold',
            color: '#1E293B',
          }}
        />
      </FlexWidget>

      {/* Footer */}
      <FlexWidget
        style={{
          height: 'wrap_content',
          width: 'match_parent',
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <TextWidget
          text="Toca para abrir la app"
          style={{
            fontSize: 10,
            color: '#94A3B8',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export const widgetTaskHandler = async () => {
  try {
    // Aquí puedes hacer una llamada a la API para obtener datos
    // Por ahora solo actualizamos el widget sin retornar datos
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // TODO: Implementar llamada a la API para obtener datos reales
    // const data = await fetchDashboardData();

    console.log('Widget actualizado:', yesterday.toLocaleDateString('es-PE'));
  } catch (error) {
    console.error('Error fetching widget data:', error);
  }
};
