// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Amenities, Features, HowItWorks, FinalCta } from './sections';
import { landingContent } from '@/lib/landing-content';
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

describe('Amenities', () => {
  it('shows every amenity as a bento tile with its label, under #amenidades', () => {
    const { container } = render(<Amenities t={es} />);
    const section = container.querySelector('#amenidades');
    expect(section).toContainElement(screen.getByRole('heading', { name: es.amenities.heading }));
    expect(container.querySelectorAll('[data-slot="amenity-tile"]')).toHaveLength(landingContent.amenities.length);
    for (const a of landingContent.amenities) {
      expect(screen.getByText(es.content.amenities[a.id])).toBeInTheDocument();
    }
  });

  it('uses aquatic placeholders, not images, while no photo is set', () => {
    const { container } = render(<Amenities t={es} items={[{ id: 'pool' }, { id: 'food' }]} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="amenity-placeholder"]')).toHaveLength(2);
  });

  it('renders the photo with next/image when an amenity has one', () => {
    const { container } = render(
      <Amenities t={es} items={[{ id: 'pool', image: '/amenities/pool.webp' }, { id: 'food' }]} />
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toMatch(/amenities(%2F|\/)pool\.webp/);
    expect(container.querySelectorAll('[data-slot="amenity-placeholder"]')).toHaveLength(1);
  });

  it('shows the opening hours', () => {
    render(<Amenities t={es} />);
    expect(screen.getByRole('heading', { name: es.amenities.scheduleHeading })).toBeInTheDocument();
    expect(screen.getByText(es.content.hours)).toBeInTheDocument();
  });

  it('hides the rules block when there are no rules', () => {
    render(<Amenities t={es} rules={[]} />);
    expect(screen.queryByRole('heading', { name: es.amenities.rulesHeading })).toBeNull();
  });

  it('shows the rules block when rules exist', () => {
    render(<Amenities t={es} rules={['Rule one', 'Rule two']} />);
    expect(screen.getByRole('heading', { name: es.amenities.rulesHeading })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: es.amenities.rulesHeading });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Rule one', 'Rule two']);
  });

  it('reads the rules from landingContent by default', () => {
    render(<Amenities t={es} />);
    const shown = screen.queryByRole('heading', { name: es.amenities.rulesHeading }) !== null;
    expect(shown).toBe(landingContent.rules.length > 0);
  });

  it('renders in English', () => {
    render(<Amenities t={en} />);
    expect(screen.getByRole('heading', { name: en.amenities.heading })).toBeInTheDocument();
    expect(screen.getByText(en.content.amenities.lifeguards)).toBeInTheDocument();
    expect(screen.getByText(en.content.hours)).toBeInTheDocument();
  });
});
