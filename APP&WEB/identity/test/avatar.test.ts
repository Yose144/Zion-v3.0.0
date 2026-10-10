import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderAvatarSvg, AVATAR_STYLES } from '../src/lib/avatar.js';

describe('renderAvatarSvg', () => {
  it('is deterministic — same inputs yield identical bytes', () => {
    const a = renderAvatarSvg('zion1abc', 0, 'sigil', 128);
    const b = renderAvatarSvg('zion1abc', 0, 'sigil', 128);
    assert.equal(a, b);
  });

  it('different seeds produce different avatars', () => {
    assert.notEqual(
      renderAvatarSvg('zion1aaa', 0, 'sigil'),
      renderAvatarSvg('zion1bbb', 0, 'sigil'),
    );
  });

  it('variant changes output', () => {
    assert.notEqual(
      renderAvatarSvg('seed', 0, 'sigil'),
      renderAvatarSvg('seed', 1, 'sigil'),
    );
  });

  it('every style renders a distinct, well-formed svg', () => {
    for (const style of AVATAR_STYLES) {
      const svg = renderAvatarSvg('seed', 0, style);
      assert.match(svg, /^<svg xmlns/);
      assert.match(svg, /<\/svg>$/);
    }
    assert.notEqual(
      renderAvatarSvg('seed', 0, 'sigil'),
      renderAvatarSvg('seed', 0, 'rings'),
    );
    assert.notEqual(
      renderAvatarSvg('seed', 0, 'rings'),
      renderAvatarSvg('seed', 0, 'prism'),
    );
  });

  it('unknown style falls back to sigil', () => {
    assert.equal(
      renderAvatarSvg('seed', 0, 'bogus'),
      renderAvatarSvg('seed', 0, 'sigil'),
    );
  });

  it('clamps size to 16..512', () => {
    assert.match(renderAvatarSvg('s', 0, 'sigil', 4), /width="16"/);
    assert.match(renderAvatarSvg('s', 0, 'sigil', 9999), /width="512"/);
    assert.match(renderAvatarSvg('s', 0, 'sigil', 64), /width="64"/);
  });

  it('never emits script/foreignObject (safe to serve inline)', () => {
    for (const style of AVATAR_STYLES) {
      for (let v = 0; v < 20; v++) {
        const svg = renderAvatarSvg(`seed-${v}`, v, style);
        assert.ok(!svg.includes('<script'), `${style} v${v} emitted <script`);
        assert.ok(!svg.includes('foreignObject'), `${style} v${v} emitted foreignObject`);
        assert.ok(!svg.includes('javascript:'), `${style} v${v} emitted javascript:`);
        assert.ok(!svg.includes('<image'), `${style} v${v} emitted <image`);
      }
    }
  });

  it('output is compact (usable inline, <5 KB)', () => {
    assert.ok(renderAvatarSvg('x'.repeat(100), 0, 'sigil', 512).length < 5120);
  });

  it('animated flag adds SMIL motion, still deterministic and safe', () => {
    for (const style of AVATAR_STYLES) {
      const anim = renderAvatarSvg('seed', 2, style, 128, true);
      const still = renderAvatarSvg('seed', 2, style, 128, false);
      assert.match(anim, /<animate/, `${style}: animated output lacks SMIL`);
      assert.ok(!still.includes('<animate'), `${style}: static output has SMIL`);
      // animated is deterministic too
      assert.equal(anim, renderAvatarSvg('seed', 2, style, 128, true));
      // animation never introduces unsafe content
      assert.ok(!anim.includes('<script'));
      assert.ok(!anim.includes('javascript:'));
      assert.ok(!anim.includes('foreignObject'));
    }
  });
});
