function gerarQRCode(canvasId, texto) {
    const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x; EXP[i + 255] = x; LOG[x] = i;
        x = (x << 1) ^ (x & 128 ? 0x11d : 0);
    }
    const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

    function rsGenPoly(deg) {
        let p = Array.of(1);
        for (let i = 0; i < deg; i++) {
            const next = new Array(p.length + 1).fill(0);
            for (let j = 0; j < p.length; j++) {
                next[j] ^= p[j];
                next[j + 1] ^= mul(p[j], EXP[i]);
            }
            p = next;
        }
        return p;
    }

    function rsRemainder(data, ecLen) {
        const gen = rsGenPoly(ecLen);
        const res = new Uint8Array(data.length + ecLen);
        res.set(data);
        for (let i = 0; i < data.length; i++) {
            const coef = res[i];
            if (coef !== 0) {
                for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], coef);
            }
        }
        return res.slice(data.length);
    }

    const bytes = new TextEncoder().encode(texto);
    const specs = Array.of(
        null,
        Array.of(1, 19, 7, 1, 19, 0, 0, Array.of()),
        Array.of(2, 34, 10, 1, 34, 0, 0, Array.of(6, 18)),
        Array.of(3, 55, 15, 1, 55, 0, 0, Array.of(6, 22)),
        Array.of(4, 80, 20, 1, 80, 0, 0, Array.of(6, 26)),
        Array.of(5, 108, 26, 1, 108, 0, 0, Array.of(6, 30)),
        Array.of(6, 136, 18, 2, 68, 0, 0, Array.of(6, 34)),
        Array.of(7, 156, 20, 2, 78, 0, 0, Array.of(6, 22, 38)),
        Array.of(8, 194, 24, 2, 97, 0, 0, Array.of(6, 24, 42)),
        Array.of(9, 232, 30, 2, 116, 0, 0, Array.of(6, 26, 46)),
        Array.of(10, 274, 18, 2, 68, 2, 69, Array.of(6, 28, 50))
    );

    const lenBits = bytes.length > 255 ? 16 : 8;
    const sp = specs.slice(1).find(s => (s.at(1) * 8) >= (4 + lenBits + bytes.length * 8));
    const ver = sp.at(0), totalData = sp.at(1), ecPerBlock = sp.at(2);
    const b1 = sp.at(3), d1 = sp.at(4), b2 = sp.at(5), d2 = sp.at(6), aligns = sp.at(7);
    const bits = Array.of();
    const pushBits = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(4, 4);
    pushBits(bytes.length, ver >= 10 ? 16 : 8);
    bytes.forEach(b => pushBits(b, 8));
    pushBits(0, Math.min(4, totalData * 8 - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCodewords = Array.of();
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits.at(i + j);
        dataCodewords.push(byte);
    }
    const pads = Array.of(0xec, 0x11);
    for (let i = 0; dataCodewords.length < totalData; i++) dataCodewords.push(pads.at(i % 2));

    const blocks = Array.of(), ecBlocks = Array.of();
    let offset = 0;
    for (let i = 0; i < b1; i++) {
        const blk = dataCodewords.slice(offset, offset + d1);
        blocks.push(blk); ecBlocks.push(rsRemainder(blk, ecPerBlock)); offset += d1;
    }
    for (let i = 0; i < b2; i++) {
        const blk = dataCodewords.slice(offset, offset + d2);
        blocks.push(blk); ecBlocks.push(rsRemainder(blk, ecPerBlock)); offset += d2;
    }

    const finalBytes = Array.of();
    for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach(b => { if (i < b.length) finalBytes.push(b.at(i)); });
    for (let i = 0; i < ecPerBlock; i++) ecBlocks.forEach(e => finalBytes.push(e.at(i)));

    const size = ver * 4 + 17;
    const grid = Array.from({ length: size }, () => new Uint8Array(size));
    const func = Array.from({ length: size }, () => new Uint8Array(size));

    const setMod = (r, c, v, isF = true) => {
        if (r >= 0 && r < size && c >= 0 && c < size) { grid[r][c] = v ? 1 : 0; if (isF) func[r][c] = 1; }
    };

    const drawFinder = (r, c) => {
        for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
            const on = (dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6) &&
                       (dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));
            setMod(r + dy, c + dx, on);
        }
    };
    drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);

    for (const cy of aligns) for (const cx of aligns) {
        if ((cy < 9 && cx < 9) || (cy < 9 && cx > size - 10) || (cy > size - 10 && cx < 9)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            setMod(cy + dy, cx + dx, Math.abs(dy) === 2 || Math.abs(dx) === 2 || (dy === 0 && dx === 0));
        }
    }

    for (let i = 8; i < size - 8; i++) {
        if (!func[6][i]) setMod(6, i, i % 2 === 0);
        if (!func[i][6]) setMod(i, 6, i % 2 === 0);
    }
    setMod(size - 8, 8, 1);

    for (let i = 0; i < 9; i++) { func[8][i] = 1; func[i][8] = 1; }
    for (let i = 0; i < 8; i++) { func[8][size - 1 - i] = 1; func[size - 1 - i][8] = 1; }
    if (ver >= 7) {
        const vInfos = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };
        const vi = vInfos[ver];
        for (let i = 0; i < 18; i++) {
            const bit = (vi >> i) & 1, a = Math.floor(i / 3), b = i % 3;
            setMod(size - 11 + b, a, bit); setMod(a, size - 11 + b, bit);
        }
    }

    let bitIdx = 0, dir = -1;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (let i = 0; i < size; i++) {
            const r = dir === -1 ? size - 1 - i : i;
            for (let dx = 0; dx < 2; dx++) {
                const c = col - dx;
                if (!func[r][c]) {
                    const raw = bitIdx < finalBytes.length * 8 ? (finalBytes.at(bitIdx >> 3) >> (7 - (bitIdx & 7))) & 1 : 0;
                    grid[r][c] = raw ^ ((r + c) % 2 === 0 ? 1 : 0);
                    bitIdx++;
                }
            }
        }
        dir *= -1;
    }

    const fmt = 0x77c4;
    const fCoords1 = Array.of(
        Array.of(8,0),Array.of(8,1),Array.of(8,2),Array.of(8,3),Array.of(8,4),Array.of(8,5),Array.of(8,7),Array.of(8,8),
        Array.of(7,8),Array.of(5,8),Array.of(4,8),Array.of(3,8),Array.of(2,8),Array.of(1,8),Array.of(0,8)
    );
    const fCoords2 = Array.of(
        Array.of(size-1,8),Array.of(size-2,8),Array.of(size-3,8),Array.of(size-4,8),Array.of(size-5,8),Array.of(size-6,8),Array.of(size-7,8),
        Array.of(8,size-8),Array.of(8,size-7),Array.of(8,size-6),Array.of(8,size-5),Array.of(8,size-4),Array.of(8,size-3),Array.of(8,size-2),Array.of(8,size-1)
    );
    for (let i = 0; i < 15; i++) {
        const bit = (fmt >> (14 - i)) & 1;
        grid[fCoords1.at(i).at(0)][fCoords1.at(i).at(1)] = bit;
        grid[fCoords2.at(i).at(0)][fCoords2.at(i).at(1)] = bit;
    }

    const canvas = document.getElementById(canvasId);
    const scale = 6, margin = 4;
    canvas.width = canvas.height = (size + margin * 2) * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1e3a8a';
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
    }
}
