import {
  Html, Head, Body, Container, Section, Text, Heading, Img, Hr,
} from '@react-email/components';
import { partyLabel } from '@/lib/party';

export interface VoucherEmailProps {
  firstName: string; lastName: string; idType: string; idNumber: string;
  code: string; date: string; adults: number; children: number;
  totalUsd: number; totalVes: number; bcvRate: number; qrUrl: string;
}

const label = { color: '#6b7280', fontSize: '13px', margin: '0' } as const;
const value = { color: '#111827', fontSize: '16px', margin: '0 0 12px' } as const;

export function VoucherEmail(p: VoucherEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', maxWidth: '420px' }}>
          <Heading as="h1" style={{ fontSize: '20px', color: '#111827' }}>
            {`Tu pase de piscina — ${p.code}`}
          </Heading>
          <Text style={{ color: '#374151' }}>
            Presenta este correo junto a tu cédula en la entrada.
          </Text>
          <Section style={{ textAlign: 'center', margin: '16px 0' }}>
            <Img src={p.qrUrl} alt={`Código QR ${p.code}`} width="180" height="180" style={{ margin: '0 auto' }} />
          </Section>
          <Hr />
          <Text style={label}>Nombre</Text>
          <Text style={value}>{`${p.firstName} ${p.lastName}`}</Text>
          <Text style={label}>Documento</Text>
          <Text style={value}>{`${p.idType}-${p.idNumber}`}</Text>
          <Text style={label}>Fecha de reserva</Text>
          <Text style={value}>{p.date}</Text>
          <Text style={label}>Asistentes</Text>
          <Text style={value}>{partyLabel(p.adults, p.children)}</Text>
          <Text style={label}>Total pagado</Text>
          <Text style={value}>
            {`$${p.totalUsd.toFixed(2)} / Bs. ${p.totalVes.toFixed(2)} (tasa BCV ${p.bcvRate.toFixed(2)})`}
          </Text>
          <Text style={label}>Reserva</Text>
          <Text style={value}>{p.code}</Text>
        </Container>
      </Body>
    </Html>
  );
}
