const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('TinyMCE and Google Identity are absent from eager script tags', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const scripts = html.match(/<script[^>]*src="[^"]+"[^>]*>/g);
    assert.ok(!scripts.some(tag => tag.includes('www.downes.ca/assets/tinymce') || tag.includes('accounts.google.com/gsi/client') || tag.includes('cdn.jsdelivr.net/npm/peerjs@')));
    const features=JSON.parse(html.match(/id="app-feature-scripts" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(features.findIndex(url=>url.startsWith('js/external-libraries.js')) < features.findIndex(url=>url.startsWith('js/blogger.js')));
});

test('startup uses the bundled icon stylesheet and a valid local WOFF2 asset', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.ok(!/https:\/\/fonts\.(googleapis|gstatic)\.com/.test(html));
    assert.match(html, /href="css\/material-icons\.css\?[^" ]+" rel="stylesheet"/);
    const css = fs.readFileSync('css/material-icons.css', 'utf8');
    const asset = css.match(/url\('\.\.\/([^']+\.woff2)'\)/)[1];
    const font = fs.readFileSync(asset);
    assert.equal(font.toString('ascii', 0, 4), 'wOF2');
    assert.equal(font.readUInt32BE(8), font.length);
    assert.match(fs.readFileSync('assets/fonts/material-icons/LICENSE.txt', 'utf8'), /Apache License/);
});
