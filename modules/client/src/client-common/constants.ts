import { activeContractsList } from "@bosagora/osx-ethers";
import { NetworkDeployment, SupportedNetworks } from "./interfaces/common";
import { ProposalMetadata } from "./interfaces/plugin";

export const UNSUPPORTED_PROPOSAL_METADATA_LINK: ProposalMetadata = {
  title: "(unsupported metadata link)",
  summary: "(the link to the metadata is not supported)",
  description: "(the link to the metadata is not supported)",
  resources: [],
};
export const EMPTY_PROPOSAL_METADATA_LINK: ProposalMetadata = {
  title: "(the proposal has no metadata)",
  summary: "(the current proposal does not have any content defined)",
  description: "(the current proposal does not have any content defined)",
  resources: [],
};
export const UNAVAILABLE_PROPOSAL_METADATA: ProposalMetadata = {
  title: "(unavailable metadata)",
  summary: "(the proposal metadata is not available)",
  description: "(the proposal metadata is not available)",
  resources: [],
};

export const LIVE_CONTRACTS: { [K in SupportedNetworks]: NetworkDeployment } = {
  mainnet: {
    daoFactory: activeContractsList.mainnet.DAOFactory,
    pluginSetupProcessor: activeContractsList.mainnet.PluginRepoFactory,
    multisigRepo: activeContractsList.mainnet["multisig-repo"],
    adminRepo: activeContractsList.mainnet["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.mainnet["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.mainnet["token-voting-repo"],
    multisigSetup: activeContractsList.mainnet.MultisigSetup,
    adminSetup: activeContractsList.mainnet.AdminSetup,
    addresslistVotingSetup: activeContractsList.mainnet.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.mainnet.TokenVotingSetup,
  },
  goerli: {
    daoFactory: activeContractsList.goerli.DAOFactory,
    pluginSetupProcessor: activeContractsList.goerli.PluginSetupProcessor,
    multisigRepo: activeContractsList.goerli["multisig-repo"],
    adminRepo: activeContractsList.goerli["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.goerli["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.goerli["token-voting-repo"],
    multisigSetup: activeContractsList.goerli.MultisigSetup,
    adminSetup: activeContractsList.goerli.AdminSetup,
    addresslistVotingSetup: activeContractsList.goerli.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.goerli.TokenVotingSetup,
  },
  maticmum: {
    daoFactory: activeContractsList.mumbai.DAOFactory,
    pluginSetupProcessor: activeContractsList.mumbai.PluginSetupProcessor,
    multisigRepo: activeContractsList.mumbai["multisig-repo"],
    adminRepo: activeContractsList.mumbai["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.mumbai["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.mumbai["token-voting-repo"],
    multisigSetup: activeContractsList.mumbai.MultisigSetup,
    adminSetup: activeContractsList.mumbai.AdminSetup,
    addresslistVotingSetup: activeContractsList.mumbai.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.mumbai.TokenVotingSetup,
    ensRegistry: activeContractsList.mumbai.ENSRegistry,
  },
  matic: {
    daoFactory: activeContractsList.polygon.DAOFactory,
    pluginSetupProcessor: activeContractsList.polygon.PluginSetupProcessor,
    multisigRepo: activeContractsList.polygon["multisig-repo"],
    adminRepo: activeContractsList.polygon["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.polygon["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.polygon["token-voting-repo"],
    multisigSetup: activeContractsList.polygon.MultisigSetup,
    adminSetup: activeContractsList.polygon.AdminSetup,
    addresslistVotingSetup: activeContractsList.polygon.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.polygon.TokenVotingSetup,
    ensRegistry: activeContractsList.polygon.ENSRegistry,
  },
  bosagora: {
    daoFactory: activeContractsList.bosagora.DAOFactory,
    pluginSetupProcessor: activeContractsList.bosagora.PluginSetupProcessor,
    multisigRepo: activeContractsList.bosagora["multisig-repo"],
    adminRepo: activeContractsList.bosagora["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.bosagora["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.bosagora["token-voting-repo"],
    multisigSetup: activeContractsList.bosagora.MultisigSetup,
    adminSetup: activeContractsList.bosagora.AdminSetup,
    addresslistVotingSetup: activeContractsList.bosagora.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.bosagora.TokenVotingSetup,
    ensRegistry: activeContractsList.bosagora.ENSRegistry,
  },
  athens: {
    daoFactory: activeContractsList.athens.DAOFactory,
    pluginSetupProcessor: activeContractsList.athens.PluginSetupProcessor,
    multisigRepo: activeContractsList.athens["multisig-repo"],
    adminRepo: activeContractsList.athens["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.athens["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.athens["token-voting-repo"],
    multisigSetup: activeContractsList.athens.MultisigSetup,
    adminSetup: activeContractsList.athens.AdminSetup,
    addresslistVotingSetup: activeContractsList.athens.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.athens.TokenVotingSetup,
    ensRegistry: activeContractsList.athens.ENSRegistry,
  },
  localhost: {
    daoFactory: activeContractsList.localhost.DAOFactory,
    pluginSetupProcessor: activeContractsList.localhost.PluginSetupProcessor,
    multisigRepo: activeContractsList.localhost["multisig-repo"],
    adminRepo: activeContractsList.localhost["admin-repo"],
    addresslistVotingRepo:
      activeContractsList.localhost["address-list-voting-repo"],
    tokenVotingRepo: activeContractsList.localhost["token-voting-repo"],
    multisigSetup: activeContractsList.localhost.MultisigSetup,
    adminSetup: activeContractsList.localhost.AdminSetup,
    addresslistVotingSetup:
      activeContractsList.localhost.AddresslistVotingSetup,
    tokenVotingSetup: activeContractsList.localhost.TokenVotingSetup,
    ensRegistry: activeContractsList.localhost.ENSRegistry,
  },
};
