// @ts-ignore
declare const describe, it, beforeAll, afterAll, expect;

// mocks need to be at the top of the imports
import { mockedIPFSClient } from "../../mocks/aragon-sdk-ipfs";

import * as ganacheSetup from "../../helpers/ganache-setup";
import * as deployContracts from "../../helpers/deployContracts";

import {
  AddresslistVotingClient,
  CanVoteParams,
  Context,
  ContextPlugin,
  CreateMajorityVotingProposalParams,
  ExecuteProposalStep,
  IProposalQueryParams,
  IVoteProposalParams,
  PrepareInstallationStep,
  ProposalCreationSteps,
  ProposalMetadata,
  ProposalSortBy,
  ProposalStatus,
  SortDirection,
  VoteProposalStep,
  VoteValues,
  VotingMode,
} from "../../../src";
import { InvalidAddressOrEnsError } from "@bosagora/sdk-common";
import {
  contextParamsLocalChain,
  contextParamsOkWithGraphqlTimeouts,
  TEST_ADDRESSLIST_DAO_ADDDRESS,
  TEST_ADDRESSLIST_PLUGIN_ADDRESS,
  TEST_ADDRESSLIST_PROPOSAL_ID,
  TEST_INVALID_ADDRESS,
  TEST_NON_EXISTING_ADDRESS,
  TEST_WALLET_ADDRESS,
} from "../constants";
import { Server } from "ganache";
import {
  mineBlock,
  mineBlockWithTimeOffset,
  restoreBlockTime,
} from "../../helpers/block-times";
import { buildAddressListVotingDAO } from "../../helpers/build-daos";
import { JsonRpcProvider } from "@ethersproject/providers";
import { AddresslistVotingPluginPrepareInstallationParams } from "../../../src/addresslistVoting/interfaces";
import { LIVE_CONTRACTS } from "../../../src/client-common/constants";

describe("Client Address List", () => {
  let server: Server;
  let deployment: deployContracts.Deployment;
  let repoAddr: string;
  let provider: JsonRpcProvider;

  beforeAll(async () => {
    server = await ganacheSetup.start();
    deployment = await deployContracts.deploy();
    contextParamsLocalChain.daoFactoryAddress = deployment.daoFactory.address;
    repoAddr = deployment.addresslistVotingRepo.address;

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
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    return restoreBlockTime(provider);
  });

  // Helpers
  async function buildDaos() {
    const daoEntries: Array<{ dao: string; plugin: string }> = [];
    daoEntries.push(
      await buildAddressListVotingDAO(repoAddr, VotingMode.STANDARD),
    );
    daoEntries.push(
      await buildAddressListVotingDAO(repoAddr, VotingMode.EARLY_EXECUTION),
    );
    daoEntries.push(
      await buildAddressListVotingDAO(repoAddr, VotingMode.VOTE_REPLACEMENT),
    );
    return daoEntries;
  }

  async function buildProposal(
    pluginAddress: string,
    client: AddresslistVotingClient,
  ) {
    // generate actions
    const action = client.encoding.updatePluginSettingsAction(pluginAddress, {
      votingMode: VotingMode.VOTE_REPLACEMENT,
      supportThreshold: 0.5,
      minParticipation: 0.5,
      minDuration: 7200,
    });

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

    const ipfsUri = await client.methods.pinMetadata(
      metadata,
    );
    const endDate = new Date(Date.now() + 60 * 60 * 1000 + 10 * 1000);

    const proposalParams: CreateMajorityVotingProposalParams = {
      pluginAddress,
      metadataUri: ipfsUri,
      actions: [action],
      executeOnPass: false,
      endDate,
    };

    for await (
      const step of client.methods.createProposal(
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
            /^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/i,
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

  async function voteProposal(
    proposalId: string,
    client: AddresslistVotingClient,
    voteValue: VoteValues = VoteValues.YES,
  ) {
    const voteParams: IVoteProposalParams = {
      proposalId,
      vote: voteValue,
    };
    for await (const step of client.methods.voteProposal(voteParams)) {
      switch (step.key) {
        case VoteProposalStep.VOTING:
          expect(typeof step.txHash).toBe("string");
          expect(step.txHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
          break;
        case VoteProposalStep.DONE:
          break;
        default:
          throw new Error(
            "Unexpected vote proposal step: " +
              Object.keys(step).join(", "),
          );
      }
    }
  }

  describe("Proposal Creation", () => {
    it("Should create a new proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const daoEntries = await buildDaos();

      for (const daoEntry of daoEntries) {
        const { plugin: pluginAddress } = daoEntry;
        if (!pluginAddress) {
          throw new Error("No plugin installed");
        }

        const proposalId = await buildProposal(pluginAddress, client);
        expect(typeof proposalId).toBe("string");
        expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);
      }
    });
  });
  describe("Can vote", () => {
    it("Should check if an user can vote in an Address List proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const daoEntries = await buildDaos();

      for (const daoEntry of daoEntries) {
        const { plugin: pluginAddress } = daoEntry;
        if (!pluginAddress) {
          throw new Error("No plugin installed");
        }

        const proposalId = await buildProposal(pluginAddress, client);
        expect(typeof proposalId).toBe("string");
        expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

        const params: CanVoteParams = {
          voterAddressOrEns: TEST_WALLET_ADDRESS,
          proposalId,
          vote: VoteValues.YES,
        };
        const canVote = await client.methods.canVote(params);
        expect(typeof canVote).toBe("boolean");
        expect(canVote).toBe(true);
      }
    });
  });

  describe("Vote on a proposal", () => {
    it("Should vote on a proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const daoEntries = await buildDaos();

      for (const daoEntry of daoEntries) {
        const { plugin: pluginAddress } = daoEntry;
        if (!pluginAddress) {
          throw new Error("No plugin installed");
        }

        const proposalId = await buildProposal(pluginAddress, client);
        expect(typeof proposalId).toBe("string");
        expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

        // Vote
        await voteProposal(proposalId, client);
      }
    });
    it("Should replace a vote on a proposal locally", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.VOTE_REPLACEMENT,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      // Vote YES
      await voteProposal(proposalId, client, VoteValues.YES);

      await mineBlock(provider);
      await voteProposal(proposalId, client, VoteValues.NO);
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
      const client = new AddresslistVotingClient(ctxPlugin);
      const { dao } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.VOTE_REPLACEMENT,
      );
      const installationParams:
        AddresslistVotingPluginPrepareInstallationParams = {
          settings: {
            votingSettings: {
              supportThreshold: 0.5,
              minParticipation: 0.5,
              minDuration: 7200,
              minProposerVotingPower: BigInt(1),
              votingMode: VotingMode.STANDARD,
            },
            addresses: [TEST_WALLET_ADDRESS],
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
              if (permission.condition) {
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

  describe("Can execute", () => {
    it("Should check if an user can execute a standard voting proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.STANDARD,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      let canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // now approve
      await voteProposal(proposalId, client);
      // Force date past end
      await mineBlockWithTimeOffset(provider, 2 * 60 * 60);

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(true);
    });

    it("Should check if an user can execute an early execution proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.EARLY_EXECUTION,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      let canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // now approve
      await voteProposal(proposalId, client);
      // No waiting

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(true);
    });

    it("Should check if an user can execute a vote replacement proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.VOTE_REPLACEMENT,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      let canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // vote no
      await voteProposal(proposalId, client, VoteValues.NO);

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(false);

      // now approve
      await voteProposal(proposalId, client, VoteValues.YES);

      // Force date past end
      await mineBlockWithTimeOffset(provider, 2 * 60 * 60);

      canExecute = await client.methods.canExecute(proposalId);
      expect(typeof canExecute).toBe("boolean");
      expect(canExecute).toBe(true);
    });
  });

  describe("Execute proposal", () => {
    it("Should execute a standard voting proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.STANDARD,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      // Vote
      await voteProposal(proposalId, client);
      // Force date past end
      await mineBlockWithTimeOffset(provider, 2 * 60 * 60);

      // Execute
      for await (
        const step of client.methods.executeProposal(proposalId)
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

    it("Should execute an early execution proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.EARLY_EXECUTION,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      // Vote
      await voteProposal(proposalId, client);
      // No waiting here

      // Execute
      for await (
        const step of client.methods.executeProposal(proposalId)
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

    it("Should execute a vote replacement proposal", async () => {
      const ctx = new Context(contextParamsLocalChain);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const { plugin: pluginAddress } = await buildAddressListVotingDAO(
        repoAddr,
        VotingMode.VOTE_REPLACEMENT,
      );
      if (!pluginAddress) {
        throw new Error("No plugin installed");
      }

      const proposalId = await buildProposal(pluginAddress, client);
      expect(typeof proposalId).toBe("string");
      expect(proposalId).toMatch(/^0x[A-Fa-f0-9]{40}_0x[A-Fa-f0-9]{1,64}$/);

      // Vote
      await voteProposal(proposalId, client, VoteValues.NO);
      await voteProposal(proposalId, client, VoteValues.YES);
      // Force date past end
      await mineBlockWithTimeOffset(provider, 2 * 60 * 60);

      // Execute
      for await (
        const step of client.methods.executeProposal(proposalId)
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
    it("Should get the list of members that can vote in a proposal", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const wallets = await client.methods.getMembers(
        TEST_ADDRESSLIST_PLUGIN_ADDRESS,
      );

      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBeGreaterThan(0);
      for (const wallet of wallets) {
        expect(typeof wallet).toBe("string");
        expect(wallet).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
      }
    });
    it("Should fetch the given proposal", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const proposalId = TEST_ADDRESSLIST_PROPOSAL_ID;

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
      if (proposal) {
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
        for (let i = 0; i < proposal.metadata.resources.length; i++) {
          const resource = proposal.metadata.resources[i];
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
        expect(proposal.startDate instanceof Date).toBe(true);
        expect(proposal.endDate instanceof Date).toBe(true);
        expect(proposal.creationDate instanceof Date).toBe(true);
        expect(typeof proposal.creationBlockNumber === "number").toBe(true);
        expect(Array.isArray(proposal.actions)).toBe(true);
        // actions
        for (let i = 0; i < proposal.actions.length; i++) {
          const action = proposal.actions[i];
          expect(action.data instanceof Uint8Array).toBe(true);
          expect(typeof action.to).toBe("string");
          expect(typeof action.value).toBe("bigint");
        }
        // result
        expect(typeof proposal.result.yes).toBe("number");
        expect(typeof proposal.result.no).toBe("number");
        expect(typeof proposal.result.abstain).toBe("number");
        // setttings
        expect(typeof proposal.settings.duration).toBe("number");
        expect(typeof proposal.settings.supportThreshold).toBe("number");
        expect(typeof proposal.settings.minParticipation).toBe("number");
        expect(
          proposal.settings.supportThreshold >= 0 &&
            proposal.settings.supportThreshold <= 1,
        ).toBe(true);
        expect(
          proposal.settings.minParticipation >= 0 &&
            proposal.settings.minParticipation <= 1,
        ).toBe(true);
        // token
        expect(typeof proposal.totalVotingWeight).toBe("number");
        expect(Array.isArray(proposal.votes)).toBe(true);
        for (let i = 0; i < proposal.votes.length; i++) {
          const vote = proposal.votes[i];
          expect(typeof vote.address).toBe("string");
          expect(vote.address).toMatch(/^0x[A-Fa-f0-9]{40}$/i);
          expect(typeof vote.vote).toBe("number");
          expect(typeof vote.voteReplaced).toBe("boolean");
        }
        if (
          proposal.executionDate && proposal.executionBlockNumber &&
          proposal.executionTxHash
        ) {
          expect(proposal.executionTxHash).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
          expect(proposal.executionDate instanceof Date).toBe(true);
          expect(typeof proposal.executionBlockNumber === "number").toBe(true);
        }
      }
    });
    it("Should fetch the given proposal and fail because the proposal does not exist", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const proposalId = TEST_NON_EXISTING_ADDRESS + "_0x0";
      const proposal = await client.methods.getProposal(proposalId);

      expect(proposal === null).toBe(true);
    });
    it("Should get a list of proposals filtered by the given criteria", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);
      const limit = 5;
      const status = ProposalStatus.DEFEATED;
      const params: IProposalQueryParams = {
        limit,
        sortBy: ProposalSortBy.CREATED_AT,
        direction: SortDirection.ASC,
        status,
      };
      const proposals = await client.methods.getProposals(params);

      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length <= limit).toBe(true);
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
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
        expect(proposal.status).toBe(status);
        // result
        expect(typeof proposal.result.yes).toBe("number");
        expect(typeof proposal.result.no).toBe("number");
        expect(typeof proposal.result.abstain).toBe("number");
      }
    });
    it("Should get a list of proposals from a specific dao", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);
      const limit = 5;
      const address = TEST_ADDRESSLIST_DAO_ADDDRESS;
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
      const client = new AddresslistVotingClient(ctxPlugin);
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
      const client = new AddresslistVotingClient(ctxPlugin);
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
    it("Should get the settings of a plugin given a plugin instance address", async () => {
      const ctx = new Context(contextParamsOkWithGraphqlTimeouts);
      const ctxPlugin = ContextPlugin.fromContext(ctx);
      const client = new AddresslistVotingClient(ctxPlugin);

      const pluginAddress: string = TEST_ADDRESSLIST_PLUGIN_ADDRESS;
      const settings = await client.methods.getVotingSettings(pluginAddress);

      expect(settings === null).toBe(false);
      if (settings) {
        expect(typeof settings.minDuration).toBe("number");
        expect(typeof settings.minParticipation).toBe("number");
        expect(typeof settings.supportThreshold).toBe("number");
        expect(typeof settings.minProposerVotingPower).toBe("bigint");
        expect(settings.supportThreshold).toBeLessThanOrEqual(1);
        expect(settings.minParticipation).toBeLessThanOrEqual(1);
      }
    });
  });
});
