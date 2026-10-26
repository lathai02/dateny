import { Heart, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { PlaceCategoryFilter } from "@/lib/places/types";
export type Mode = "solo" | "couple" | "friends";

export const modeData: Record<
  Mode,
  { label: string; optionLabel: string; titles: string[]; icon: LucideIcon }
> = {
  solo: {
    label: "Một mình",
    optionLabel: "Cho riêng mình",
    icon: UserRound,
    titles: [
      "Một góc riêng, đúng mood hôm nay.",
      "Đi một mình, vui theo cách mình.",
      "Một chỗ yên để thở chậm lại.",
      "Hôm nay cứ chiều mình một chút.",
      "Một chiếc bàn dành riêng cho bạn.",
      "Chậm một nhịp, tận hưởng theo ý mình.",
      "Quán hợp gu, thời gian thuộc về bạn.",
      "Một mình, nhưng chẳng hề buồn.",
      "Ghé một nơi khiến mình thấy dễ chịu.",
      "Tự thưởng mình một buổi thật ngon.",
    ],
  },
  couple: {
    label: "Hẹn hò",
    optionLabel: "Cho hai người",
    icon: Heart,
    titles: [
      "Một nơi cho hai người, thêm chuyện để nhớ.",
      "Hai người, một quán vừa xinh.",
      "Chọn một chỗ để câu chuyện dài thêm.",
      "Hẹn nhau ở một nơi thật hợp.",
      "Một chiếc bàn, hai người, nhiều điều để kể.",
      "Để buổi hẹn bắt đầu bằng một quán hay.",
      "Có nhau rồi, để Dateny chọn chỗ.",
      "Một nơi vừa đủ riêng cho hai người.",
      "Hôm nay mình cùng đi đâu đó nhé.",
      "Chọn đúng quán, giữ trọn mood hẹn hò.",
    ],
  },
  friends: {
    label: "Bạn bè",
    optionLabel: "Cho cả hội",
    icon: UsersRound,
    titles: [
      "Một kèo cho cả hội, vui từ lúc chọn quán.",
      "Cả hội đã đủ, giờ chỉ thiếu quán.",
      "Chốt kèo nhanh, vui lâu hơn.",
      "Một chỗ rộng mood cho cả nhóm.",
      "Hội mình đi đâu cũng vui, miễn đúng quán.",
      "Gọi đủ bạn, để Dateny gọi tên quán.",
      "Tụ họp thôi, quán xịn để Dateny lo.",
      "Một chiếc bàn cho mọi câu chuyện.",
      "Kèo này nhất định phải đi.",
      "Bạn bè đông đủ, cuộc vui bắt đầu.",
    ],
  },
};

export const categoryLabels: Record<PlaceCategoryFilter, string> = {
  all: "Tất cả",
  restaurant: "Nhà hàng",
  cafe: "Cà phê",
  fast_food: "Ăn nhanh",
};
export const categories = Object.keys(categoryLabels) as PlaceCategoryFilter[];
export const radiusOptions = [1_000, 2_000, 3_000, 5_000];
