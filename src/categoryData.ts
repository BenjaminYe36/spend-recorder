export const categories = ["买菜", "加油", "租房", "Utilities", "饭店", "Outlets", "家装家具", "Gym", "保险"]
    .map((val) => {
        return {displayName: val};
    });

export const subCategories = new Map();

subCategories.set("买菜", ["Fred Meyer", "QFC", "Safeway", "百家", "Costco", "T&T", "Amazon Fresh", "Walmart", "Hmart", "Smart", "WJMY", "Target"]);
subCategories.set("加油", ["Costco", "ARCO", "其它"]);
subCategories.set("租房", ["全部"]);
subCategories.set("Utilities", ["网络", "电费", "水费和垃圾", "手机"]);
subCategories.set("饭店", ["McDonald's", "Chipotle", "KFC", "Domino's Pizza"]);
subCategories.set("Outlets", ["Gap"]);
subCategories.set("家装家具", ["IKEA", "Home Depot", "Fred Meyer"]);
subCategories.set("Gym", ["LA Fitness"]);
subCategories.set("保险", ["车险", "医疗保险"]);