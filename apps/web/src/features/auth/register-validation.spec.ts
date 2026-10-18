import { RegisterValues, toRegisterPayload, validateRegister } from './register-validation';

const valid: RegisterValues = {
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  phone: '',
  password: 'senha12345',
};

describe('validateRegister', () => {
  it('dados validos nao geram erro', () => {
    expect(validateRegister(valid)).toEqual({});
  });

  it('campos obrigatorios vazios geram um erro por campo, em pt-BR', () => {
    const errors = validateRegister({ name: '', email: '', phone: '', password: '' });

    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password']);
    expect(errors.name).toBe('Informe seu nome, com pelo menos 2 letras.');
    expect(errors.email).toBe('Informe um e-mail válido.');
    expect(errors.password).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  describe('nome (a API exige no minimo 2 caracteres)', () => {
    it.each(['', ' ', '   ', 'A', ' A '])('rejeita %j (espacos nao contam)', (name) => {
      expect(validateRegister({ ...valid, name })).toHaveProperty('name');
    });

    it.each(['Al', 'Zé', ' Ana ', 'João da Silva'])('aceita %j', (name) => {
      expect(validateRegister({ ...valid, name })).not.toHaveProperty('name');
    });
  });

  describe('e-mail', () => {
    it.each(['', 'abc', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com'])(
      'rejeita %j',
      (email) => {
        expect(validateRegister({ ...valid, email })).toHaveProperty('email');
      },
    );

    it.each([
      'mariana@example.com',
      ' mariana@example.com ',
      'Mariana@Example.COM',
      'a.b+c@sub.dominio.com.br',
    ])('aceita %j', (email) => {
      expect(validateRegister({ ...valid, email })).not.toHaveProperty('email');
    });
  });

  describe('senha (a API exige no minimo 8 caracteres)', () => {
    it.each(['', '1234567', 'curta'])('rejeita %j', (password) => {
      expect(validateRegister({ ...valid, password })).toHaveProperty('password');
    });

    it.each(['12345678', 'uma senha com espacos', 'çãõ-áéí-12'])('aceita %j', (password) => {
      expect(validateRegister({ ...valid, password })).not.toHaveProperty('password');
    });

    it('nao apara espacos da senha: eles fazem parte dela', () => {
      expect(validateRegister({ ...valid, password: '       a' })).not.toHaveProperty('password');
    });
  });

  describe('telefone (opcional; com DDD, 10 ou 11 digitos)', () => {
    it.each(['', '   '])('vazio (%j) e aceito', (phone) => {
      expect(validateRegister({ ...valid, phone })).not.toHaveProperty('phone');
    });

    it.each(['(47) 99999-9999', '47999999999', '4733334444', '47 9 9999 9999', '(47)3333-4444'])(
      'aceita %j',
      (phone) => {
        expect(validateRegister({ ...valid, phone })).not.toHaveProperty('phone');
      },
    );

    it.each(['123', 'abc', '479999999999', '999999999', '+55 47 99999-9999'])(
      'rejeita %j',
      (phone) => {
        expect(validateRegister({ ...valid, phone })).toHaveProperty('phone');
      },
    );

    it('a mensagem mostra um exemplo de formato', () => {
      expect(validateRegister({ ...valid, phone: '123' }).phone).toContain('(47) 99999-9999');
    });
  });

  it('varios campos invalidos acumulam os erros', () => {
    const errors = validateRegister({ name: 'A', email: 'x', phone: '1', password: '1' });

    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password', 'phone']);
  });
});

describe('toRegisterPayload', () => {
  it('apara nome e e-mail e mantem a senha exatamente como digitada', () => {
    const payload = toRegisterPayload({
      name: '  Mariana Silva ',
      email: ' mariana@example.com ',
      phone: '',
      password: '  senha com espacos  ',
    });

    expect(payload.name).toBe('Mariana Silva');
    expect(payload.email).toBe('mariana@example.com');
    expect(payload.password).toBe('  senha com espacos  ');
  });

  it('manda o telefone so com digitos', () => {
    expect(toRegisterPayload({ ...valid, phone: '(47) 99999-9999' }).phone).toBe('47999999999');
  });

  it('sem telefone, a chave nem existe (a API recusa campo nao declarado)', () => {
    expect(toRegisterPayload({ ...valid, phone: '   ' })).not.toHaveProperty('phone');
  });

  it('so contem campos que a API aceita (forbidNonWhitelisted rejeita qualquer outro)', () => {
    const payload = toRegisterPayload({ ...valid, phone: '47999999999' });

    expect(Object.keys(payload).sort()).toEqual(['email', 'name', 'password', 'phone']);
  });
});
