// @ts-ignore
declare const describe, it, beforeAll, afterAll, expect;

// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";

import * as ganacheSetup from "../../helpers/ganache-setup";
import * as deployContracts from "../../helpers/deployContracts";

import {
  ApproveMultisigProposalParams,
  ApproveProposalStep,
  CanApproveParams,
  Context,
  ContextPlugin,
  CreateMultisigProposalParams,
  IProposalQueryParams,
  MultisigClient,
  MultisigPluginPrepareInstallationParams,
  PrepareInstallationStep,
  ProposalCreationSteps,
  ProposalMetadata,
  ProposalSortBy,
  SortDirection,
} from "../../../src";
import { GraphQLError, InvalidAddressOrEnsError } from "@bosagora/sdk-common";
import {
  contextParamsLocalChain,
  contextParamsOkWithGraphqlTimeouts,
  TEST_INVALID_ADDRESS,
  TEST_MULTISIG_DAO_ADDRESS,
  TEST_MULTISIG_PLUGIN_ADDRESS,
  TEST_MULTISIG_PROPOSAL_ID,
  TEST_NON_EXISTING_ADDRESS,
  TEST_WALLET_ADDRESS,
} from "../constants";
import { Server } from "ganache";
// import { advanceBlocks } from "../../helpers/advance-blocks";
import { ExecuteProposalStep } from "../../../src";
import { buildMultisigDAO } from "../../helpers/build-daos";
import { mineBlock, restoreBlockTime } from "../../helpers/block-times";
import { JsonRpcProvider } from "@ethersproject/providers";
import { LIVE_CONTRACTS } from "../../../src/client-common/constants";

describe("Client Multisig", () => {
  let deployment: deployContracts.Deployment;
  let server: Server;
  let repoAddr: string;
  let provider: JsonRpcProvider;

  beforeAll(async () => {
    server = await ganacheSetup.start();
    deployment = await deployContracts.deploy();
    contextParamsLocalChain.daoFactoryAddress = deployment.daoFactory.address;
    repoAddr = deployment.multisigRepo.address;

    if (Array.isArray(contextParamsLocalChain.web3Providers)) {
      provider = new JsonRpcProvider(
        contextParamsLocalChain.web3Providers[0] as string,
      );
    } else {
      provider = new JsonRpcProvider(
        contextParamsLocalChain.web3Providers as any,
      );
    }
    LIVE_CONTRACTS.goerli.daoFactory = deployment.daoFactory.address;
    LIVE_CONTRACTS.goerli.pluginSetupProcessor =
      deployment.pluginSetupProcessor.address;
    LIVE_CONTRACTS.goerli.multisigRepo = deployment.multisigRepo.address;
    LIVE_CONTRACTS.goerli.adminRepo = "";
    LIVE_CONTRACTS.goerli.addresslistVotingRepo =
      deployment.addresslistVotingRepo.address;
    LIVE_CONTRACTS.goerli.tokenVotingRepo = deployment.tokenVotingRepo.address;
    LIVE_CONTRACTS.goerli.multisigSetup =
      deployment.multisigPluginSetup.address;
    LIVE_CONTRACTS.goerli.adminSetup = "";
    LIVE_CONTRACTS.goerli.addresslistVotingSetup =
      deployment.addresslistVotingPluginSetup.address;
    LIVE_CONTRACTS.goerli.tokenVotingSetup =
      deployment.tokenVotingPluginSetup.address;
    await restoreBlockTime(provider);
  });

  afterAll(async () => {
    await server.close();
  });

  async function buildDao() {
    const result = await buildMultisigDAO(repoAddr);
    await mineBlock(provider);
    return result;
  }

  async function buildProposal(
    pluginAddress: string,
    multisigClient: MultisigClient,
  ): Promise<string> {
    // generate actions
    const action = multisigClient.encoding.updateMultisigVotingSettings(
      {
        pluginAddress,
        votingSettings: {
          minApprovals: 1,
          onlyListed: true,
        },
      },
    );

    const metadata: ProposalMetadata = {
      title: "Best Proposal",
      summary: "this is the sumnary",
      description: "This is a very long description",
      resources: [
        {
          name: "Website",
          url: "https://the.website",
        },
      ],
      media: {
        header: "https://no.media/media.jpeg",
        logo: "https://no.media/media.jpeg",
      },
    };
    const ipfsUri = await multisigClient.methods.pinMetadata(metadata);
    const endDate = new Date(Date.now() + 1000 * 60);
    const proposalParams: CreateMultisigProposalParams = {
      pluginAddress,
      metadataUri: ipfsUri,
      actions: [action],
      failSafeActions: [false],
      endDate,
    };

    for await (
      const step of multisigClient.methods.createProposal(
        proposalParams,
      )
    ) {
      switch (step.key) {
        case ProposalCreationSteps.CREATING:
          expect(typeof step.txHash).toBe("string");
          expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
          break;
        case ProposalCreationSteps.DONE:
          expect(typeof step.proposalId).toBe("string");
          expect(step.proposalId).toMatch(
            /^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/,
          );
          return step.proposalId;
        default:
          throw new Error(
            "Unexpected proposal creation step: " +
              Object.keys(step).join(", "),
          );
      }
    }
    throw new Error();
  }
  async function approveProposal(
    proposalId: string,
    client: MultisigClient,
  ) {
    const approveParams: ApproveMultisigProposalParams = {
      proposalId,
      tryExecution: false,
    };
    for await (const step of client.methods.approveProposal(approveParams)) {
      switch (step.key) {
        case ApproveProposalStep.APPROVING:
          expect(typeof step.txHash).toBe("string");
          expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
          break;
        case ApproveProposalStep.DONE:
          break;
        default:
          throw new Error(
            "Unexpected approve proposal step: " +
              Object.keys(step).join(", "),
          );
      }
    }
  }

  describe("Proposal Creation", () => {
    it("Should create a new proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const multisigClient = new MultisigClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildDao();

      await buildProposal(pluginAddress, multisigClient);
    });
  });

  describe("Plugin installation", () => {
    it("Should prepare the installation of a token voting plugin", async () => {
      const networkSpy = jest.spyOn(JsonRpcProvider, "getNetwork");
      networkSpy.mockReturnValueOnce({
        name: "goerli",
        chainId: 31337,
      });
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      const { dao } = await buildMultisigDAO(
        repoAddr,
      );
      const installationParams: MultisigPluginPrepareInstallationParams = {
        settings: {
          members: [TEST_WALLET_ADDRESS],
          votingSettings: {
            minApprovals: 1,
            onlyListed: true,
          },
        },
        daoAddressOrEns: dao,
      };
      const steps = client.methods.prepareInstallation(installationParams);
      for await (const step of steps) {
        switch (step.key) {
          case PrepareInstallationStep.PREPARING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case PrepareInstallationStep.DONE:
            expect(typeof step.pluginAddress).toBe("string");
            expect(step.pluginAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(typeof step.pluginRepo).toBe("string");
            expect(step.pluginRepo).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            expect(Array.isArray(step.helpers)).toBe(true);
            for (const helper of step.helpers) {
              expect(typeof helper).toBe("string");
            }
            expect(Array.isArray(step.permissions)).toBe(true);
            for (const permission of step.permissions) {
              expect(typeof permission.condition).toBe("string");
              if(permission.condition) {
                expect(permission.condition).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              }
              expect(typeof permission.operation).toBe("number");
              expect(typeof permission.where).toBe("string");
              expect(permission.where).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
              expect(typeof permission.who).toBe("string");
              expect(permission.who).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
            }
            expect(typeof step.versionTag.build).toBe("number");
            expect(typeof step.versionTag.release).toBe("number");
            break;
        }
      }
    });
  });

  describe("Can approve", () => {
    it("Should check if an user can approve in a multisig instance", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      // const address = await client.web3.getSigner()?.getAddress();

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      const canApproveParams: CanApproveParams = {
        proposalId,
        approverAddressOrEns: TEST_WALLET_ADDRESS,
      };
      // positive
      let canApprove = await client.methods.canApprove(canApproveParams);
      expect(typeof canApprove).toBe("boolean");
      expect(canApprove).toBe(true);

      // negative
      canApproveParams.approverAddressOrEns =
        "0x0000000000000000000000000000000000000000";
      canApprove = await client.methods.canApprove(canApproveParams);
      expect(typeof canApprove).toBe("boolean");
      expect(canApprove).toBe(false);
    });
  });

  describe("Approve proposal", () => {
    it("Should approve a local proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      await approveProposal(proposalId, client);
    });
  });

  describe("Can execute", () => {
    it("Should check if an user can execute in a multisig instance", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      let canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // now approve
      await approveProposal(proposalId, client);

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(true);
    });
  });

  describe("Execute proposal", () => {
    it("Should execute a local proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildDao();

      const proposalId = await buildProposal(pluginAddress, client);
      await approveProposal(proposalId, client);

      for await (
        const step of client.methods.executeProposal(
          proposalId,
        )
      ) {
        switch (step.key) {
          case ExecuteProposalStep.EXECUTING:
            expect(typeof step.txHash).toBe("string");
            expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
            break;
          case ExecuteProposalStep.DONE:
            break;
          default:
            throw new Error(
              "Unexpected execute proposal step: " +
                Object.keys(step).join(", "),
            );
        }
      }
    });
  });

  describe("Data retrieval", () => {
    it("Should get the voting settings of the plugin", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const settings = await client.methods.getVotingSettings(
        TEST_MULTISIG_PLUGIN_ADDRESS,
      );
      expect(typeof settings).toBe("object");
      expect(typeof settings.minApprovals).toBe("number");
      expect(typeof settings.onlyListed).toBe("boolean");
    });

    it("Should get members of the multisig", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const wallets = await client.methods.getMembers(
        TEST_MULTISIG_PLUGIN_ADDRESS,
      );
      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBeGreaterThan(0);
      expect(typeof wallets[0]).toBe("string");
      expect(wallets[0]).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
    });

    it("Should fetch the given proposal", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const proposalId = TEST_MULTISIG_PROPOSAL_ID;

      mockedIPFSClient.cat.mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            title: "Title",
            summary: "Summary",
            description: "Description",
            resources: [{
              name: "Name",
              url: "URL",
            }],
          }),
        ),
      );

      const proposal = await client.methods.getProposal(proposalId);

      expect(typeof proposal).toBe("object");
      expect(proposal === null).toBe(false);
      if (!proposal) {
        throw new GraphQLError("multisig proposal");
      }
      expect(proposal.id).toBe(proposalId);
      expect(typeof proposal.id).toBe("string");
      expect(proposal.id).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/i);
      expect(typeof proposal.dao.address).toBe("string");
      expect(proposal.dao.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
      expect(typeof proposal.dao.name).toBe("string");
      expect(typeof proposal.creatorAddress).toBe("string");
      expect(proposal.creatorAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
      // check metadata
      expect(typeof proposal.metadata.title).toBe("string");
      expect(typeof proposal.metadata.summary).toBe("string");
      expect(typeof proposal.metadata.description).toBe("string");
      expect(Array.isArray(proposal.metadata.resources)).toBe(true);
      for (const resource of proposal.metadata.resources) {
        expect(typeof resource.name).toBe("string");
        expect(typeof resource.url).toBe("string");
      }
      if (proposal.metadata.media) {
        if (proposal.metadata.media.header) {
          expect(typeof proposal.metadata.media.header).toBe("string");
        }
        if (proposal.metadata.media.logo) {
          expect(typeof proposal.metadata.media.logo).toBe("string");
        }
      }
      expect(proposal.creationDate instanceof Date).toBe(true);
      expect(proposal.startDate instanceof Date).toBe(true);
      expect(proposal.endDate instanceof Date).toBe(true);
      expect(Array.isArray(proposal.actions)).toBe(true);
      // actions
      for (const action of proposal.actions) {
        expect(action.data instanceof Uint8Array).toBe(true);
        expect(typeof action.to).toBe("string");
        expect(typeof action.value).toBe("bigint");
      }
      for (const approval of proposal.approvals) {
        expect(typeof approval).toBe("string");
        expect(approval).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
      }
      if (
        proposal.executionTxHash && proposal.executionDate &&
        proposal.executionBlockNumber
      ) {
        expect(proposal.executionTxHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
        expect(proposal.executionDate instanceof Date).toBe(true);
        expect(typeof proposal.executionBlockNumber).toBe("number");
      }
      expect(typeof proposal.settings.minApprovals).toBe("number");
      expect(typeof proposal.settings.onlyListed).toBe("boolean");
    });
    it("Should fetch the given proposal and fail because the proposal does not exist", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);

      const proposalId = TEST_NON_EXISTING_ADDRESS + "_0x1";
      const proposal = await client.methods.getProposal(proposalId);

      expect(proposal === null).toBe(true);
    });
    it("Should get a list of proposals filtered by the given criteria", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      const limit = 5;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length <= limit).toBe(true);
      for (const proposal of proposals) {
        expect(typeof proposal.id).toBe("string");
        expect(proposal.id).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,}$/i);
        expect(typeof proposal.dao.address).toBe("string");
        expect(proposal.dao.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        expect(typeof proposal.dao.name).toBe("string");
        expect(typeof proposal.creatorAddress).toBe("string");
        expect(proposal.creatorAddress).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        expect(typeof proposal.metadata.title).toBe("string");
        expect(typeof proposal.metadata.summary).toBe("string");
        expect(proposal.startDate instanceof Date).toBe(true);
        expect(proposal.endDate instanceof Date).toBe(true);
        for (const approval of proposal.approvals) {
          expect(typeof approval).toBe("string");
          expect(approval).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
        }
        expect(typeof proposal.settings.minApprovals).toBe("number");
        expect(typeof proposal.settings.onlyListed).toBe("boolean");
      }
    });
    it("Should get a list of proposals from a specific dao", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      const limit = 5;
      const address = TEST_MULTISIG_DAO_ADDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length > 0 && proposals.length <= limit).toBe(true);
    });
    it("Should get a list of proposals from a dao that has no proposals", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      const limit = 5;
      const address = TEST_NON_EXISTING_ADDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length === 0).toBe(true);
    });
    it("Should get a list of proposals from an invalid address", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new MultisigClient(ctxPlugin);
      const limit = 5;
      const address = TEST_INVALID_ADDRESS;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        daoAddressOrEns: address,
      };
      await expect(() => client.methods.getProposals(params)).rejects.toThrow(
        new InvalidAddressOrEnsError(),
      );
    });
  });
});
