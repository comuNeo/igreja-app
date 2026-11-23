// ================= MUDE APENAS ESTAS 2 LINHAS ABAIXO =================
const SUPABASE_URL = 'https://ybkjxivsvgkugmlzccvi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlia2p4aXZzdmdrdWdtbHpjY3ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzODIzOTAsImV4cCI6MjExMDk1ODM5MH0.slEodBChTigoeQm5oC4bfpADOKNpMkKJNItSW5HXUdw';
// ================= NÃO MUDE NADA DAQUI PARA BAIXO =================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let pedidosCarregados = [];

window.onload = function() {
    localStorage.removeItem('membro_nome');
    localStorage.removeItem('membro_whatsapp');
    localStorage.removeItem('membro_endereco');
};

const prayerForm = document.getElementById('prayer-form');
if (prayerForm) {
    prayerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = prayerForm.querySelector('button[type="submit"]');
        const textoOriginalBtn = submitBtn ? submitBtn.innerText : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Enviando...';
        }

        const nome = document.getElementById('nome').value.trim();
        const whatsapp = document.getElementById('whatsapp').value.trim();
        const pedido = document.getElementById('pedido').value.trim();
        const visita = document.getElementById('visita') ? document.getElementById('visita').value.trim() : '';
        const estudo = document.getElementById('estudo') ? document.getElementById('estudo').checked : false;
        const endereco = document.getElementById('endereco') ? document.getElementById('endereco').value.trim() : '';

        const { error } = await supabaseClient
            .from('pedidos')
            .insert([
                {
                    nome: nome,
                    whatsapp: whatsapp,
                    pedido: pedido,
                    visita_horario: visita,
                    estudo_biblico: estudo,
                    endereco: endereco
                }
            ]);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = textoOriginalBtn;
        }

        if (error) {
            console.error('Erro ao salvar pedido:', error);
            alert('Erro ao enviar o pedido. Tente novamente.');
            return;
        }

        prayerForm.reset();

        // Rola a tela para o topo para mostrar a caixa verde de confirmação
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const successMsg = document.getElementById('success-msg');
        if (successMsg) {
            successMsg.innerHTML = '🙏 Parabéns! Seu pedido de oração foi enviado com sucesso. Estaremos orando por você!';
            successMsg.style.display = 'block';
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 7000);
        }

        // Exibe também um aviso imediato na tela do celular
        alert('🙏 Parabéns! Seu pedido de oração foi enviado com sucesso. Estaremos orando por você!');
    });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;

        if (user === 'Oraadm' && pass === '123') {
            loginForm.reset();
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('admin-view').classList.remove('hidden');
            loadPrayers();
        } else {
            alert('Login ou senha incorretos!');
        }
    });
}

function logout() {
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
}

async function loadPrayers() {
    const tbody = document.getElementById('prayers-list');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando pedidos...</td></tr>';

    const { data, error } = await supabaseClient
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar pedidos:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Erro ao carregar pedidos do banco de dados.</td></tr>';
        return;
    }

    pedidosCarregados = data || [];
    tbody.innerHTML = '';

    if (pedidosCarregados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Nenhum pedido de oração registrado ainda.</td></tr>';
        return;
    }

    pedidosCarregados.forEach(p => {
        const dataObj = new Date(p.created_at);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        p.dataFormatada = dataFormatada;

        const cleanPhone = (p.whatsapp || '').replace(/\D/g, '');
        const fullPhone = cleanPhone.length <= 11 && cleanPhone.length > 0 ? `55${cleanPhone}` : cleanPhone;
        const waLink = `https://wa.me{fullPhone}?text=Olá ${encodeURIComponent(p.nome)}, paz! Recebemos o seu pedido de oração na igreja e estamos orando por você.`;

        let detalhesExtras = '';
        if (p.visita_horario) detalhesExtras += `<br><small>🏠 <strong>Visita/Horário:</strong> ${p.visita_horario}</small>`;
        if (p.estudo_biblico) detalhesExtras += `<br><small>📖 <strong>Estudo Bíblico:</strong> Sim, tem interesse</small>`;
        if (p.endereco) detalhesExtras += `<br><small>📍 <strong>Endereço:</strong> ${p.endereco}</small>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="white-space: nowrap;">${dataFormatada}</td>
            <td><strong>${p.nome}</strong></td>
            <td>
                ${p.whatsapp || '-'}<br>
                ${cleanPhone ? `<a href="${waLink}" target="_blank" class="btn-whatsapp">💬 Chamar no WhatsApp</a>` : ''}
            </td>
            <td>${p.pedido}${detalhesExtras}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportCSV() {
    if (pedidosCarregados.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }

    let csvContent = "\uFEFFData;Nome;WhatsApp;Pedido;Visita e Horario;Estudo Biblico;Endereco\n";
    pedidosCarregados.forEach(p => {
        const dataStr = p.dataFormatada || new Date(p.created_at).toLocaleString('pt-BR');
        const estudoStr = p.estudo_biblico ? 'Sim' : 'Não';
        const row = `"${dataStr}";"${p.nome}";"${p.whatsapp || ''}";"${p.pedido.replace(/"/g, '""')}";"${(p.visita_horario || '').replace(/"/g, '""')}";"${estudoStr}";"${(p.endereco || '').replace(/"/g, '""')}"`;
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "relatorio_pedidos_oracao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
