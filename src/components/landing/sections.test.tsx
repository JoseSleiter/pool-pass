// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Features, HowItWorks, FinalCta } from './sections';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

const stepKeys = ['date', 'group', 'pay', 'voucher'] as const;

describe('landing sections', () => {
  it('render the Spanish copy', () => {
    render(<><Features t={es} /><HowItWorks t={es} /><FinalCta t={es} /></>);
    expect(screen.getByRole('heading', { name: /todo lo que necesitas/i })).toBeInTheDocument();
    expect(screen.getByText('Reserva en minutos')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Recibe tu voucher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reservar mi pase/i })).toHaveAttribute('href', '/reservar');
  });

  it('render the English copy', () => {
    render(<><Features t={en} /><HowItWorks t={en} /><FinalCta t={en} /></>);
    expect(screen.getByRole('heading', { name: /everything you need/i })).toBeInTheDocument();
    expect(screen.getByText('How your booking works')).toBeInTheDocument();
    expect(screen.getByText(en.howItWorks.details.pay)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /book my pass/i })).toBeInTheDocument();
  });

  it('keeps the header anchors: #como-funciona on the steps, #precios on the final CTA', () => {
    const { container } = render(<><Features t={es} /><HowItWorks t={es} /><FinalCta t={es} /></>);
    const howItWorks = container.querySelectorAll('#como-funciona');
    expect(howItWorks).toHaveLength(1);
    expect(howItWorks[0]).toContainElement(screen.getByRole('heading', { name: es.howItWorks.heading }));
    const prices = container.querySelectorAll('#precios');
    expect(prices).toHaveLength(1);
    expect(prices[0]).toContainElement(screen.getByRole('link', { name: /reservar mi pase/i }));
  });
});

describe('HowItWorks', () => {
  it('renders the four steps in order, each with its title and detail', () => {
    render(<HowItWorks t={es} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    stepKeys.forEach((key, i) => {
      expect(within(items[i]).getByRole('heading', { name: es.howItWorks.steps[key] })).toBeInTheDocument();
      expect(within(items[i]).getByText(es.howItWorks.details[key])).toBeInTheDocument();
      expect(within(items[i]).getByText(String(i + 1).padStart(2, '0'))).toBeInTheDocument();
    });
  });

  it('joins the steps with three connectors (none after the last step)', () => {
    const { container } = render(<HowItWorks t={es} />);
    expect(container.querySelectorAll('[data-slot="step-connector"]')).toHaveLength(3);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[3].querySelector('[data-slot="step-connector"]')).toBeNull();
  });

  it('server-renders every step visible, so nothing depends on JS to appear', () => {
    const html = renderToString(<HowItWorks t={es} />);
    expect(html).not.toContain('data-reveal');
    for (const key of stepKeys) {
      expect(html).toContain(es.howItWorks.steps[key]);
      expect(html).toContain(es.howItWorks.details[key]);
    }
  });
});
