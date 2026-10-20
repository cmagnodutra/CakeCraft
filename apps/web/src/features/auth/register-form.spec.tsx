import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { registerUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { RegisterForm } from './register-form';

jest.mock('@/lib/api/auth');

const registerUserMock = jest.mocked(registerUser);
const texts = messages.auth.register;

const createdUser = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE' as const,
  xp: 0,
  level: 1,
};

/** Promessa que o teste resolve ou rejeita quando quiser (para ver o estado "carregando"). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(texts.fields.name), '  Mariana Silva ');
  await user.type(screen.getByLabelText(texts.fields.email), 'mariana@example.com');
  await user.type(screen.getByLabelText(texts.fields.password), 'senha12345');
}

const submit = () => screen.getByRole('button', { name: texts.submit });

beforeEach(() => registerUserMock.mockReset());

describe('RegisterForm', () => {
  describe('estrutura', () => {
    it('mostra o titulo, os quatro campos rotulados e o botao de criar conta', () => {
      render(<RegisterForm />);

      expect(screen.getByRole('heading', { level: 1, name: texts.title })).toBeInTheDocument();
      for (const label of Object.values(texts.fields)) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
      expect(submit()).toHaveAttribute('type', 'submit');
    });

    it('usa os tipos e autocompletes certos (teclado do celular e gerenciador de senhas)', () => {
      render(<RegisterForm />);

      expect(screen.getByLabelText(texts.fields.name)).toHaveAttribute('autocomplete', 'name');
      expect(screen.getByLabelText(texts.fields.email)).toHaveAttribute('type', 'email');
      expect(screen.getByLabelText(texts.fields.email)).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText(texts.fields.phone)).toHaveAttribute('type', 'tel');
      expect(screen.getByLabelText(texts.fields.password)).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(texts.fields.password)).toHaveAttribute(
        'autocomplete',
        'new-password',
      );
    });

    it('marca como obrigatorios nome, e-mail e senha, mas nao o telefone', () => {
      render(<RegisterForm />);

      expect(screen.getByLabelText(texts.fields.name)).toBeRequired();
      expect(screen.getByLabelText(texts.fields.email)).toBeRequired();
      expect(screen.getByLabelText(texts.fields.password)).toBeRequired();
      expect(screen.getByLabelText(texts.fields.phone)).not.toBeRequired();
    });

    it('desliga a validacao nativa do navegador: as mensagens sao as nossas, em pt-BR', () => {
      const { container } = render(<RegisterForm />);

      expect(container.querySelector('form')).toHaveAttribute('novalidate');
    });
  });

  describe('validacao antes de chamar a API', () => {
    it('formulario vazio mostra o erro de cada campo obrigatorio e nao chama a API', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);

      await user.click(submit());

      expect(screen.getByText(texts.validation.name)).toBeInTheDocument();
      expect(screen.getByText(texts.validation.email)).toBeInTheDocument();
      expect(screen.getByText(texts.validation.password)).toBeInTheDocument();
      expect(registerUserMock).not.toHaveBeenCalled();
    });

    it('foca o primeiro campo invalido (quem usa teclado ou leitor de tela cai no erro)', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);

      await user.click(submit());
      expect(screen.getByLabelText(texts.fields.name)).toHaveFocus();

      await user.type(screen.getByLabelText(texts.fields.name), 'Mariana');
      await user.click(submit());
      expect(screen.getByLabelText(texts.fields.email)).toHaveFocus();
    });

    it('o erro de um campo some quando o usuario volta a digitar nele, e so dele', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      await user.click(submit());

      await user.type(screen.getByLabelText(texts.fields.name), 'M');

      expect(screen.queryByText(texts.validation.name)).not.toBeInTheDocument();
      expect(screen.getByText(texts.validation.email)).toBeInTheDocument();
    });

    it('telefone preenchido de forma invalida e recusado, mas vazio e aceito', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      await fillValid(user);
      await user.type(screen.getByLabelText(texts.fields.phone), '123');

      await user.click(submit());

      expect(screen.getByText(texts.validation.phone)).toBeInTheDocument();
      expect(registerUserMock).not.toHaveBeenCalled();
    });
  });

  describe('envio', () => {
    it('chama a API com o corpo normalizado: nome aparado e telefone so com digitos', async () => {
      const user = userEvent.setup();
      registerUserMock.mockResolvedValue(createdUser);
      render(<RegisterForm />);
      await fillValid(user);
      await user.type(screen.getByLabelText(texts.fields.phone), '(47) 99999-9999');

      await user.click(submit());

      expect(registerUserMock).toHaveBeenCalledTimes(1);
      expect(registerUserMock).toHaveBeenCalledWith({
        name: 'Mariana Silva',
        email: 'mariana@example.com',
        password: 'senha12345',
        phone: '47999999999',
      });
    });

    it('sem telefone, o corpo enviado nao tem a chave phone', async () => {
      const user = userEvent.setup();
      registerUserMock.mockResolvedValue(createdUser);
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      expect(registerUserMock.mock.calls[0][0]).not.toHaveProperty('phone');
    });

    it('enquanto a API responde: botao ocupado e desabilitado, e cliques extras nao duplicam o envio', async () => {
      const user = userEvent.setup();
      const pending = deferred<typeof createdUser>();
      registerUserMock.mockReturnValue(pending.promise);
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());
      const busy = screen.getByRole('button', { name: new RegExp(texts.submit) });
      expect(busy).toHaveAttribute('aria-busy', 'true');
      expect(busy).toBeDisabled();

      await user.click(busy);
      await user.click(busy);
      expect(registerUserMock).toHaveBeenCalledTimes(1);

      pending.resolve(createdUser);
      await screen.findByRole('heading', { name: texts.success.title });
    });
  });

  describe('envio duplo no mesmo instante (ex.: Enter apertado duas vezes)', () => {
    it('dois eventos submit antes do re-render chamam a API uma unica vez', async () => {
      const user = userEvent.setup();
      const pending = deferred<typeof createdUser>();
      registerUserMock.mockReturnValue(pending.promise);
      const { container } = render(<RegisterForm />);
      await fillValid(user);
      const form = container.querySelector('form') as HTMLFormElement;

      // Dois submits sincronos: o botao ainda nao foi redesenhado como
      // desabilitado, entao so a guarda interna impede o envio duplo.
      fireEvent.submit(form);
      fireEvent.submit(form);

      expect(registerUserMock).toHaveBeenCalledTimes(1);

      pending.resolve(createdUser);
      await screen.findByRole('heading', { name: texts.success.title });
    });

    it('depois que a primeira tentativa falha, um novo envio e permitido', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(createdUser);
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());
      await screen.findByText(texts.errors.network);
      await user.click(submit());

      expect(registerUserMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sucesso', () => {
    it('troca o formulario pela confirmacao, com o primeiro nome e o caminho de volta', async () => {
      const user = userEvent.setup();
      registerUserMock.mockResolvedValue(createdUser);
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      expect(
        await screen.findByRole('heading', { level: 1, name: texts.success.title }),
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(texts.success.welcome('Mariana'));
      expect(screen.getByRole('link', { name: texts.success.backHome })).toHaveAttribute(
        'href',
        '/',
      );
      expect(screen.queryByLabelText(texts.fields.password)).not.toBeInTheDocument();
    });

    it('move o foco para o novo titulo (o formulario sumiu; sem isso o foco se perde)', async () => {
      const user = userEvent.setup();
      registerUserMock.mockResolvedValue(createdUser);
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      const heading = await screen.findByRole('heading', { name: texts.success.title });
      await waitFor(() => expect(heading).toHaveFocus());
    });

    it('usa o nome devolvido pela API, nao o digitado', async () => {
      const user = userEvent.setup();
      registerUserMock.mockResolvedValue({ ...createdUser, name: 'Ana Souza' });
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      expect(await screen.findByRole('status')).toHaveTextContent('Ana');
    });
  });

  describe('erros da API', () => {
    it('e-mail ja cadastrado (409): erro no campo e-mail, foco nele e dados mantidos', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValue(
        new ApiError(409, ['Ja existe uma conta com este e-mail.']),
      );
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      const email = screen.getByLabelText(texts.fields.email);
      expect(await screen.findByText(texts.errors.emailTaken)).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveFocus();
      expect(email).toHaveValue('mariana@example.com');
      expect(screen.getByLabelText(texts.fields.name)).toHaveValue('  Mariana Silva ');
      expect(submit()).toBeEnabled();
    });

    it('o erro de e-mail repetido some quando o usuario corrige o e-mail', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValue(new ApiError(409, []));
      render(<RegisterForm />);
      await fillValid(user);
      await user.click(submit());
      await screen.findByText(texts.errors.emailTaken);

      await user.type(screen.getByLabelText(texts.fields.email), 'x');

      expect(screen.queryByText(texts.errors.emailTaken)).not.toBeInTheDocument();
    });

    it('queda de rede: aviso geral em pt-BR, e tudo o que o usuario digitou continua la', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValue(new NetworkError());
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(texts.errors.network);
      expect(screen.getByLabelText(texts.fields.password)).toHaveValue('senha12345');
      expect(submit()).toBeEnabled();
    });

    it('erro do servidor (500): diz que o problema e do nosso lado', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValue(new ApiError(500, []));
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(texts.errors.server);
    });

    it('nunca mostra a mensagem crua da API', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValue(new ApiError(400, ['email must be an email']));
      render(<RegisterForm />);
      await fillValid(user);

      await user.click(submit());

      await screen.findByRole('alert');
      expect(screen.queryByText(/must be an email/)).not.toBeInTheDocument();
    });

    it('depois de um erro, tentar de novo funciona e o aviso antigo some', async () => {
      const user = userEvent.setup();
      registerUserMock.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(createdUser);
      render(<RegisterForm />);
      await fillValid(user);
      await user.click(submit());
      await screen.findByText(texts.errors.network);

      await user.click(submit());

      expect(await screen.findByRole('heading', { name: texts.success.title })).toBeInTheDocument();
      expect(screen.queryByText(texts.errors.network)).not.toBeInTheDocument();
    });
  });
});
