import { normalizeMemberStatus } from '@/lib/members-data';
import { prepareMemberDataForAPI } from '@/lib/member-service';
import { buildMemberEditUrl } from '@/lib/navigation';

describe('normalizeMemberStatus', () => {
  it('maps fallecido variants to deceased', () => {
    expect(normalizeMemberStatus('fallecido')).toBe('deceased');
    expect(normalizeMemberStatus('fallecida')).toBe('deceased');
    expect(normalizeMemberStatus('deceased')).toBe('deceased');
  });

  it('maps spanish and english status variants correctly', () => {
    expect(normalizeMemberStatus('activo')).toBe('active');
    expect(normalizeMemberStatus('active')).toBe('active');
    expect(normalizeMemberStatus('menos activo')).toBe('less_active');
    expect(normalizeMemberStatus('less active')).toBe('less_active');
    expect(normalizeMemberStatus('inactivo')).toBe('inactive');
    expect(normalizeMemberStatus('inactive')).toBe('inactive');
  });

  it('defaults to active for unknown values', () => {
    expect(normalizeMemberStatus(undefined)).toBe('active');
    expect(normalizeMemberStatus(null)).toBe('active');
    expect(normalizeMemberStatus('')).toBe('active');
    expect(normalizeMemberStatus('otro')).toBe('active');
  });
});

describe('buildMemberEditUrl', () => {
  it('adds returnTo when valid', () => {
    expect(buildMemberEditUrl('123', '/converts')).toBe('/members?edit=123&returnTo=%2Fconverts');
  });

  it('omits returnTo when invalid', () => {
    expect(buildMemberEditUrl('123', 'http://example.com')).toBe('/members?edit=123');
  });
});

describe('prepareMemberDataForAPI', () => {
  it('includes deathDate when provided', () => {
    const deathDate = new Date('2024-05-10T00:00:00.000Z');
    const result = prepareMemberDataForAPI(
      {
        firstName: 'Juan',
        lastName: 'Perez',
        status: 'deceased',
        deathDate,
      },
      null,
      []
    );

    expect(result.deathDate).toBe(deathDate.toISOString());
  });

  it('omits deathDate when not provided', () => {
    const result = prepareMemberDataForAPI(
      {
        firstName: 'Ana',
        lastName: 'Lopez',
        status: 'active',
      },
      null,
      []
    );

    expect(result.deathDate).toBe(undefined);
  });
});
