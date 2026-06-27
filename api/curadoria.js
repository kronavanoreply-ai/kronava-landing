const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

module.exports = async (req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Insere o lead (ignora duplicatas)
  const { error: dbError } = await supabase
    .from('leads_curadoria')
    .insert([{ email }]);

  if (dbError) {
    if (dbError.code === '23505') {
      // Email já cadastrado — retorna sucesso mesmo assim
      return res.status(200).json({ message: 'Já cadastrado' });
    }
    console.error('Supabase error:', dbError);
    return res.status(500).json({ error: 'Erro ao salvar' });
  }

  // Envia email de confirmação via Resend
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Kronava <curadoria@kronava.com.br>',
      to: email,
      subject: 'Sua solicitação foi recebida — Kronava',
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 48px 24px; color: #2a2a2a; background: #F5F3EF;">
          <p style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #8a7355; margin-bottom: 32px;">KRONAVA</p>
          <h1 style="font-size: 28px; font-weight: 400; line-height: 1.3; margin-bottom: 24px;">Solicitação recebida.</h1>
          <p style="font-size: 15px; color: #6b6b6b; line-height: 1.8; margin-bottom: 32px;">
            Sua solicitação de acesso à lista de convidados foi registrada com sucesso.<br><br>
            O acesso ao MVP está sendo liberado em ondas restritas. Você será notificado quando sua vez chegar.
          </p>
          <p style="font-size: 13px; color: #aaa; border-top: 1px solid #e0ddd7; padding-top: 24px; margin-top: 32px;">
            Kronava — Sua mente livre para o macro.
          </p>
        </div>
      `
    });
  } catch (emailError) {
    // Email falhou mas lead foi salvo — não retorna erro
    console.error('Resend error:', emailError);
  }

  return res.status(200).json({ message: 'Cadastrado com sucesso' });
};
