import 'dotenv/config';
import { Resend } from 'resend';
import { teams } from '../clients/teams';

const resend = new Resend(process.env.RESEND_API_KEY);

export type NotificationAction = 'created' | 'updated' | 'teams_notified';

export interface NotificationData {
  taskId: string;
  taskName: string;
  action: NotificationAction;
}

export type ClickUpSyncNotification = Omit<NotificationData, 'action'> & {
  action: 'created' | 'updated';
};

const RECIPIENT_EMAILS = {
  felipe: process.env.EMAIL_FELIPE,
  andreia: process.env.EMAIL_ANDREIA,
  gisele: process.env.EMAIL_GISELE,
};
const EMAIL_COPY: Record<
  NotificationAction,
  { subjectPrefix: string; actionText: string; headline: string }
> = {
  created: {
    subjectPrefix: 'Tarefa criada no ClickUp',
    actionText: 'criada no ClickUp',
    headline: 'Uma nova tarefa foi criada no ClickUp',
  },
  updated: {
    subjectPrefix: 'Tarefa atualizada no ClickUp',
    actionText: 'atualizada no ClickUp',
    headline: 'Uma tarefa foi atualizada no ClickUp',
  },
  teams_notified: {
    subjectPrefix: 'Tarefa comunicada no Teams',
    actionText: 'notificada no Microsoft Teams',
    headline: 'Uma tarefa foi comunicada no Microsoft Teams',
  },
};

async function sendTeamsNotification(
  data: ClickUpSyncNotification,
): Promise<void> {
  if (!process.env.TEAMS_WEBHOOK_URL) {
    console.warn('TEAMS_WEBHOOK_URL não configurado. Notificação para Teams não será enviada.');
    return;
  }

  const actionText = data.action === 'created' ? 'criada' : 'atualizada';
  const actionColor = data.action === 'created' ? '00FF00' : 'FFA500';
  const clickupUrl = `https://app.clickup.com/t/${data.taskId}`;

  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Tarefa ${actionText} no ClickUp`,
    themeColor: actionColor,
    title: `✅ Tarefa ${actionText} no ClickUp`,
    sections: [
      {
        activityTitle: data.taskName,
        facts: [
          {
            name: 'ID da Tarefa:',
            value: data.taskId,
          },
          {
            name: 'Ação:',
            value: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'Ver no ClickUp',
        targets: [
          {
            os: 'default',
            uri: clickupUrl,
          },
        ],
      },
    ],
  };

  try {
    await teams.post('', card);
    console.log('Notificação enviada para Teams com sucesso');
  } catch (error) {
    console.error('Erro ao enviar notificação para Teams:', error);
  }
}

async function sendEmailNotification(
  recipient: string,
  data: NotificationData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurado. Notificação por email não será enviada.');
    return;
  }

  const copy = EMAIL_COPY[data.action] ?? EMAIL_COPY.updated;
  const clickupUrl = `https://app.clickup.com/t/${data.taskId}`;
  const subject = `${copy.subjectPrefix}: ${data.taskName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${copy.headline}</h2>
      <p><strong>Nome da tarefa:</strong> ${data.taskName}</p>
      <p><strong>ID da tarefa:</strong> ${data.taskId}</p>
      <p><strong>Ação:</strong> ${copy.actionText}</p>
      <p><a href="${clickupUrl}" style="background-color: #7B68EE; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver tarefa no ClickUp</a></p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Esta é uma notificação automática da integração Notion-ClickUp.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Notion-ClickUp <onboarding@resend.dev>',
      to: recipient,
      subject,
      html,
    });

    console.log(`Email de notificação enviado para ${recipient}`);
  } catch (error) {
    console.error(`Erro ao enviar email para ${recipient}:`, error);
  }
}

export async function notifyRecipientsByEmail(
  data: NotificationData,
): Promise<void> {
  const recipients = Object.values(RECIPIENT_EMAILS).filter(
    (email): email is string => typeof email === 'string' && email.length > 0,
  );

  if (recipients.length === 0) {
    console.warn(
      'Nenhum destinatário configurado. Pulei o envio de email da notificação.',
    );
    return;
  }

  for (const recipient of recipients) {
    await sendEmailNotification(recipient, data);
  }
}

export async function sendNotifications(
  tasks: Array<ClickUpSyncNotification>,
  options?: { sendEmail?: boolean },
): Promise<void> {
  if (tasks.length === 0) {
    return;
  }

  console.log(`Enviando notificações sobre ${tasks.length} tarefa(s)...`);
  const shouldSendEmail = options?.sendEmail ?? false;

  for (const task of tasks) {
    await sendTeamsNotification(task);

    if (shouldSendEmail) {
      await notifyRecipientsByEmail(task);
    }
  }

  console.log('Todas as notificações foram enviadas.');
}
