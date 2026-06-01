import type { AddOn, Plan } from '@heroku-cli/schema';
import vscode from 'vscode';
import type { Command } from '@oclif/config';
import AddOnAttachmentService from '@heroku-cli/schema/services/add-on-attachment-service.js';
import type { CommandMeta } from '../../manifest';
import { herokuCommand, HerokuOutputChannel } from '../../meta/command';
import { createHerokuSDK } from '../../utils/heroku-sdk';
import { HerokuContextMenuCommandRunner } from './heroku-context-menu-command-runner';

@herokuCommand({ outputChannelId: HerokuOutputChannel.CommandOutput })
/**
 * Any other commands. This acts as a catch-all for commands
 * that do to have a dedicated command runner.
 */
export class HerokuAddOnCommandRunner extends HerokuContextMenuCommandRunner {
  public static COMMAND_ID = 'heroku:addOn:runner' as const;

  /**
   *
   * @inheritdoc
   */
  protected async hydrateArgs(
    userInputByArg: Map<string, string | undefined>,
    args: CommandMeta['args'],
    addOn: AddOn
  ): Promise<void> {
    await super.hydrateArgs(userInputByArg, args, addOn);
    // Special case when changing plans.
    // populate the options with the list
    // of available plans.
    if (this.commandName === 'addons:upgrade') {
      this.injectPlanOptionsIntoCommand(args.plan, addOn);
    }

    if (this.commandName === 'addons:detach') {
      this.injectAttachmentOptionsIntoCommand(args.attachment_name, addOn);
    }

    if (!addOn) {
      return;
    }

    if (args.addon?.required) {
      userInputByArg.set('addon', addOn.name);
    }
    if (args.service?.required) {
      userInputByArg.set('service', addOn.addon_service.name);
    }
    if (args.addonName?.required) {
      userInputByArg.set('addonName', addOn.name);
    }
    if (args.addon_name?.required) {
      userInputByArg.set('addon_name', addOn.name);
    }
  }

  /**
   * Injects the list of available plans into the "plan" argument.
   * This utilizes the async VSCode QuickPick API to present the user with
   * a list of plans to choose from.
   *
   * @param upgradePlanArgs The "plan" argument from the "addons:upgrade" command
   * @param addOn The add-on to upgrade
   */
  protected injectPlanOptionsIntoCommand(upgradePlanArgs: Command.Arg, addOn: AddOn): void {
    Reflect.deleteProperty(upgradePlanArgs, 'options');
    if (!addOn) {
      return;
    }
    const thenable = (async (): Promise<vscode.QuickPickItem[]> => {
      const sdk = await createHerokuSDK(undefined, undefined, ['addOnExtensions']);
      // The SDK's listPlans extension returns plans sorted by price
      // ascending. The downstream code below regroups them by human_name
      // prefix; the price-sort within each group is the same as before.
      // Cast to schema Plan since the rest of this file uses that type.
      const plans = (await sdk.platform.addOn.listPlans(addOn.addon_service.id)) as unknown as Plan[];
      const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
      const items: vscode.QuickPickItem[] = [];
      let lastPlanPrefix = '';

      for (const plan of plans) {
        const [planPrefix] = plan.human_name.split(' ');
        // Add a separator when plan categories
        // appear to change.
        if (lastPlanPrefix !== planPrefix) {
          items.push({
            kind: vscode.QuickPickItemKind.Separator,
            label: planPrefix
          });
        }
        lastPlanPrefix = planPrefix;
        const perMonthMax = currencyFormatter.format(plan.price.cents / 100);
        const perHourCost = currencyFormatter.format(plan.price.cents / 100 / (24 * 30));
        items.push({
          label: `${plan.human_name} - ${perHourCost} / hour (Max ${perMonthMax}/month)`,
          description: plan.description,
          value: plan.name,
          picked: plan.id === addOn.plan.id
        } as vscode.QuickPickItem);
      }
      return items;
    })();

    Reflect.set(upgradePlanArgs, 'options', thenable);
    Reflect.set(upgradePlanArgs, 'required', true);
  }

  /**
   * Injects the list of available attachments into the "attachment_name"
   * argument. This utilizes the async VSCode QuickPick API to present the user with
   * a list of plans to choose from.
   *
   * @param detachAttachmentArg The "attachment_name" argument from the "addons:detach" command
   * @param addOn The add-on to detach an attachment from
   */
  protected injectAttachmentOptionsIntoCommand(detachAttachmentArg: Command.Arg, addOn: AddOn): void {
    const attachmentService = new AddOnAttachmentService(fetch, 'https://api.heroku.com');

    const thenable = (async (): Promise<vscode.QuickPickItem[]> => {
      const { accessToken } = (await vscode.authentication.getSession(
        'heroku:auth:login',
        []
      )) as vscode.AuthenticationSession;
      const attachments = await attachmentService.listByAddOn(addOn.id, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const items: vscode.QuickPickItem[] = [
        {
          kind: vscode.QuickPickItemKind.Separator,
          label: 'Attachments'
        }
      ];

      items.push(
        ...attachments.map(
          (a) =>
            ({
              label: a.name,
              value: a.id
            }) as vscode.QuickPickItem
        )
      );
      return items;
    })();

    Reflect.set(detachAttachmentArg, 'options', thenable);
    Reflect.set(detachAttachmentArg, 'required', true);
  }

  /**
   *
   * @inheritdoc
   */
  protected async hydrateFlags(
    userInputByFlag: Map<string, string | undefined>,
    flags: CommandMeta['flags'],
    addOn: AddOn
  ): Promise<void> {
    await super.hydrateFlags(userInputByFlag, flags, addOn);
    if (flags.addon?.required && addOn) {
      userInputByFlag.set('addon', addOn.name);
    }
    if (flags.addonName?.required && addOn) {
      userInputByFlag.set('addonName', addOn.name);
    }
  }
}
