
import React, { useState } from 'react';
import { useAppStore } from '../store.ts';

export const PrivacyPolicyView = () => {
  const [isChecked, setIsChecked] = useState(false);
  const { navigateToNewPei } = useAppStore();

  const SectionTitle = (props) => {
    const { children } = props;
    return (
        <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">{children}</h3>
    );
  };
  
  const SubTitle = (props) => {
      const { children } = props;
      return (
        <h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2">{children}</h4>
      );
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-full max-w-4xl mx-auto">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Política de Privacidade</h2>
        <button 
            onClick={navigateToNewPei}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
        >
            Voltar ao Editor
        </button>
      </div>
      
      <div className="p-6 overflow-y-auto flex-grow text-gray-600 leading-relaxed">
        <p className="text-sm text-gray-500 mb-4">Última atualização: 16 de agosto de 2025</p>
        
        <SectionTitle>1. Introdução</SectionTitle>
        <p>Bem-vindo ao <strong>Assistente de PEI com IA</strong>. Esta aplicação foi criada para auxiliar educadores e profissionais da educação na elaboração de Planos Educacionais Individualizados (PEI).</p>
        <p>A sua privacidade e a segurança dos dados com os quais você trabalha são a nossa maior prioridade. Esta Política de Privacidade explica quais informações são manuseadas, como são utilizadas e, mais importante, como garantimos a sua proteção.</p>
        <p>Ao utilizar a nossa aplicação, você concorda com as práticas descritas nesta política.</p>

        <SectionTitle>2. Onde os Dados Ficam?</SectionTitle>
        <p>É fundamental entender que esta aplicação funciona <strong>100% localmente no seu dispositivo</strong>. Nenhum dado sai do seu iPhone, iPad ou Computador.</p>
        
        <SubTitle>a) Dados Armazenados Localmente</SubTitle>
        <p>Todo o conteúdo que você cria e salva dentro da aplicação é armazenado exclusivamente no seu dispositivo, utilizando a tecnologia segura de armazenamento do seu navegador (LocalStorage e IndexedDB). Nós, como desenvolvedores, não temos acesso a nenhuma dessas informações.</p>

        <SubTitle>b) Inteligência Artificial Local (WebLLM)</SubTitle>
        <p>Diferente de outras aplicações que enviam dados para servidores externos (nuvem), esta aplicação utiliza uma tecnologia avançada chamada <strong>WebLLM via WebGPU</strong>.</p>
        <p>Isso significa que o "cérebro" da IA é baixado para o seu dispositivo na primeira vez que você usa e, a partir daí, <strong>todo o processamento acontece dentro do seu aparelho</strong>. Seus dados de alunos nunca trafegam pela internet para serem processados.</p>

        <SectionTitle>3. Uso Offline</SectionTitle>
        <p>Após o download inicial do modelo de IA, a aplicação funciona perfeitamente sem conexão com a internet. Isso garante ainda mais segurança, pois elimina riscos associados à transmissão de dados.</p>

        <SectionTitle>4. Seus Direitos e Controle</SectionTitle>
        <ul className="list-disc list-inside space-y-2 my-3 pl-4">
            <li><strong>Controle Total:</strong> Você tem controle total para acessar, corrigir e excluir todos os dados diretamente na interface da aplicação.</li>
            <li><strong>Exclusão:</strong> Ao limpar os dados do navegador ou excluir um PEI, a informação é removida permanentemente do seu dispositivo.</li>
        </ul>

        <SectionTitle>5. Segurança dos Dados</SectionTitle>
        <ul className="list-disc list-inside space-y-1 my-3 pl-4">
            <li>Os dados estão protegidos pela segurança do seu próprio dispositivo (senha, FaceID, TouchID) e pelo sandbox do navegador.</li>
            <li>Como não há servidor central, não há risco de vazamento de dados em massa a partir de nossos sistemas.</li>
        </ul>

        <SectionTitle>6. Privacidade de Crianças</SectionTitle>
        <p>A aplicação "Assistente de PEI com IA" é uma ferramenta destinada ao uso por profissionais da educação.</p>
        <ul className="list-disc list-inside space-y-1 my-3 pl-4">
            <li>A aplicação não coleta intencionalmente dados de crianças.</li>
            <li>É de responsabilidade do profissional que utiliza a ferramenta garantir que possui o consentimento necessário dos pais ou responsáveis legais para inserir e processar informações sobre os alunos, conforme as políticas da sua instituição de ensino e a legislação local.</li>
        </ul>

        <SectionTitle>7. Alterações a Esta Política de Privacidade</SectionTitle>
        <p>Podemos atualizar esta política de privacidade periodicamente. Quaisquer alterações serão publicadas nesta página.</p>

        <SectionTitle>8. Contato</SectionTitle>
        <p>Se você tiver alguma dúvida sobre esta política de privacidade ou sobre o funcionamento local da IA, entre em contato conosco.</p>
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl mt-auto">
        <label htmlFor="privacy-agree" className="flex items-center cursor-pointer select-none">
          <input 
            id="privacy-agree"
            type="checkbox" 
            checked={isChecked}
            onChange={() => setIsChecked(!isChecked)}
            className="h-5 w-5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span className="ml-3 text-sm text-gray-700">Eu li e concordo com a Política de Privacidade.</span>
        </label>
      </div>
    </div>
  );
};
