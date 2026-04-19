import React, { useContext, createContext } from "react";
import { abi } from "../abis/contractAbi.json";
import { contractAddress } from "../abis/contract-address.json";
import { useAddress, useContract, useMetamask } from "@thirdweb-dev/react";
import { ethers } from "ethers";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
const StateContext = createContext();
const DEFAULT_CAMPAIGN_IMAGE =
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80";

export const StateContextProvider = ({ children }) => {
  const { contract } = useContract(contractAddress, abi);

  const address = useAddress();
  const connect = useMetamask();
  const hasGetDonators = abi.some(
    (item) => item.type === "function" && item.name === "getDonators",
  );
  const hasGetCampaigns = abi.some(
    (item) => item.type === "function" && item.name === "getCampaigns",
  );

  const getTupleField = (value, key, index) => value?.[key] ?? value?.[index];

  const toBigNumber = (value) => {
    if (ethers.BigNumber.isBigNumber(value)) return value;
    if (typeof value === "bigint")
      return ethers.BigNumber.from(value.toString());
    if (typeof value === "number")
      return ethers.BigNumber.from(Math.floor(value));
    return ethers.BigNumber.from((value ?? "0").toString());
  };

  const toWeiTarget = (value) => {
    if (ethers.BigNumber.isBigNumber(value)) return value;
    if (typeof value === "bigint")
      return ethers.BigNumber.from(value.toString());

    const normalized = (value ?? "0").toString().trim();
    if (!normalized) return ethers.BigNumber.from(0);

    // If value is already wei-like (large integer string), pass as-is.
    if (/^\d+$/.test(normalized) && normalized.length > 18) {
      return ethers.BigNumber.from(normalized);
    }

    return ethers.utils.parseEther(normalized);
  };

  const toUnixDeadline = (value) => {
    if (typeof value === "number") {
      // Values from chain reads are usually seconds.
      if (value > 0 && value < 1_000_000_000_000) return Math.floor(value);
      return Math.floor(value / 1000);
    }

    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      const numeric = Number(value);
      if (numeric > 0 && numeric < 1_000_000_000_000)
        return Math.floor(numeric);
      return Math.floor(numeric / 1000);
    }

    return Math.floor(new Date(value).getTime() / 1000);
  };

  const normalizeFaqs = (faqs = []) =>
    faqs.map((item) => ({
      question: item.question || "",
      answer: item.answer || "",
    }));

  const normalizePackages = (packages = []) =>
    packages.map((item) => ({
      amount: item.amount || "",
      discount: item.discount || "",
    }));

  const publishCampaign = async (form) => {
    try {
      if (!contract) throw new Error("Contract is not available.");
      if (!address) {
        throw new Error(
          "Please connect your wallet before creating a campaign.",
        );
      }

      const images = Array.isArray(form.image)
        ? form.image.filter((item) => typeof item === "string" && item.trim())
        : [];
      if (!images.length) {
        images.push(DEFAULT_CAMPAIGN_IMAGE);
      }

      const data = await contract.call("createCampaign", [
        address,
        form.title,
        form.category,
        form.email,
        form.description,
        toWeiTarget(form.target),
        toUnixDeadline(form.deadline),
        images,
        normalizeFaqs(form.faqs),
        normalizePackages(form.packages),
      ]);
      toast.success("Campaign created successfully.");
      console.log("contract call success", data);
      return data;
    } catch (error) {
      toast.error(
        error?.reason || error?.message || "Campaign creation failed.",
      );
      console.log("contract call failure", error);
      throw error;
    }
  };
  const updateCampaign = async (form) => {
    try {
      if (!contract) throw new Error("Contract is not available.");
      if (!address) {
        throw new Error(
          "Please connect your wallet before updating a campaign.",
        );
      }

      const images = Array.isArray(form.image)
        ? form.image.filter((item) => typeof item === "string" && item.trim())
        : [];
      if (!images.length) {
        images.push(DEFAULT_CAMPAIGN_IMAGE);
      }

      const data = await contract.call("updateCampaign", [
        Number(form.id),
        form.title,
        form.category,
        form.email,
        form.description,
        toWeiTarget(form.target),
        toUnixDeadline(form.deadline),
        images,
        normalizeFaqs(form.faqs),
        normalizePackages(form.packages),
      ]);
      toast.success("Campaign updated successfully.");
      console.log("contract call success", data);
      return data;
    } catch (error) {
      toast.error(error?.reason || error?.message || "Campaign update failed.");
      console.log("contract call failure", error);
      throw error;
    }
  };

  const deleteCampaign = async (pId) => {
    try {
      if (!contract) return;
      const data = await contract.call("deleteCampaign", [pId]);

      toast.success("Campaign deleted successfully.");
      console.log("contract call success", data);
      return data;
    } catch (error) {
      toast.error("Error while deleting Campaign, please try again");
      console.log("contract call failure", error);
    }
  };

  const getCampaigns = async () => {
    if (!contract) return [];

    try {
      const parseCampaign = (campaign, id, canIncludeDynamicFields = true) => {
        const owner = getTupleField(campaign, "owner", 0);
        if (!owner || owner === ethers.constants.AddressZero) {
          return null;
        }

        const title = getTupleField(campaign, "title", 4) || "Untitled";
        const category = getTupleField(campaign, "category", 2) || "General";
        const email = getTupleField(campaign, "email", 3) || "";
        const description = getTupleField(campaign, "description", 5) || "";
        const target = toBigNumber(getTupleField(campaign, "target", 6));
        const deadline = Number(
          getTupleField(campaign, "deadline", 7)?.toString?.() ??
            getTupleField(campaign, "deadline", 7) ??
            0,
        );
        const amountCollected = toBigNumber(
          getTupleField(campaign, "amountCollected", 8),
        );

        const rawImage = canIncludeDynamicFields
          ? getTupleField(campaign, "image", 9)
          : [];
        const normalizedImages = Array.isArray(rawImage)
          ? rawImage
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter(Boolean)
          : [];

        const rawFaqs = canIncludeDynamicFields
          ? getTupleField(campaign, "faqs", 12)
          : [];
        const faqs = Array.isArray(rawFaqs)
          ? rawFaqs.map((item) => ({
              question: getTupleField(item, "question", 0) || "",
              answer: getTupleField(item, "answer", 1) || "",
            }))
          : [];

        const rawPackages = canIncludeDynamicFields
          ? getTupleField(campaign, "packages", 13)
          : [];
        const packages = Array.isArray(rawPackages)
          ? rawPackages.map((item) => ({
              amount: getTupleField(item, "amount", 0) || "",
              discount: getTupleField(item, "discount", 1) || "",
            }))
          : [];

        return {
          owner,
          title,
          category,
          email,
          description,
          target: ethers.utils.formatEther(target),
          deadline,
          amountCollected: ethers.utils.formatEther(amountCollected),
          image: normalizedImages.length
            ? normalizedImages
            : [DEFAULT_CAMPAIGN_IMAGE],
          pId: id,
          faqs,
          packages,
        };
      };

      let parsedCampaigns = [];

      if (hasGetCampaigns) {
        try {
          const readResults = await contract.call("getCampaigns");
          parsedCampaigns = (Array.isArray(readResults) ? readResults : [])
            .map((campaign, id) => parseCampaign(campaign, id, true))
            .filter(Boolean);
        } catch (readError) {
          console.warn(
            "[getCampaigns] getCampaigns() read failed, using fallback",
            readError,
          );
        }
      }

      if (!parsedCampaigns.length) {
        const total = await contract.call("numberOfCampaigns");
        const campaignCount = Number(total?.toString?.() ?? total ?? 0);
        const campaignsFromMapping = await Promise.all(
          Array.from({ length: campaignCount }, (_, i) =>
            contract.call("campaigns", [i]).catch(() => null),
          ),
        );

        parsedCampaigns = campaignsFromMapping
          .map((campaign, id) =>
            campaign ? parseCampaign(campaign, id, false) : null,
          )
          .filter(Boolean);
      }

      console.log(
        `[getCampaigns] Returning ${parsedCampaigns.length} parsed campaigns`,
      );
      return parsedCampaigns;
    } catch (error) {
      console.error("Error while loading campaigns", error);
      return [];
    }
  };

  const getUserCampaigns = async () => {
    const allCampaigns = await getCampaigns();

    const filteredCampaigns = allCampaigns.filter(
      (campaign) => campaign.owner === address,
    );

    return filteredCampaigns;
  };

  const donate = async (pId, amount) => {
    try {
      if (!contract) return;
      const data = await contract.call("donateToCampaign", [pId], {
        value: ethers.utils.parseEther(amount),
      });
      return data;
    } catch (err) {
      console.log("Error occured while making donation", err);
    }
  };

  const payOutToCampaignTeam = async (pId) => {
    try {
      if (!contract) return;
      const data = await contract.call("payOutToCampaignTeam", [pId]);
      toast.success("Campaign funds successfully withdrawed.");
      return data;
    } catch (err) {
      toast.error("Error occured while withdrawing funds.");
      console.log("Error occured while withdrawing funds", err);
    }
  };
  const getDonations = async (pId) => {
    if (!contract || !hasGetDonators) return [];

    try {
      const donations = await contract.call("getDonators", [pId]);
      const numberOfDonations = donations[0].length;
      const parsedDonations = [];

      for (let i = 0; i < numberOfDonations; i++) {
        parsedDonations.push({
          donator: donations[0][i],
          donation: ethers.utils.formatEther(donations[1][i].toString()),
        });
      }

      return parsedDonations;
    } catch (error) {
      return [];
    }
  };

  const getNumberOfCampaignsDonatedTo = async (donatorAddress) => {
    const allCampaigns = await getCampaigns();
    let donationCount = 0;

    for (const campaign of allCampaigns) {
      const donations = await getDonations(campaign.pId);
      const hasDonated = donations.some(
        (donation) =>
          donation.donator.toLowerCase() === donatorAddress.toLowerCase(),
      );
      if (hasDonated) {
        donationCount++;
      }
    }

    return donationCount;
  };
  return (
    <StateContext.Provider
      value={{
        address,
        contract,
        connect,
        createCampaign: publishCampaign,
        getCampaigns,
        getUserCampaigns,
        donate,
        getDonations,
        payOutToCampaignTeam,
        updateCampaign,
        deleteCampaign,
        getNumberOfCampaignsDonatedTo,
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export const useStateContext = () => useContext(StateContext);
